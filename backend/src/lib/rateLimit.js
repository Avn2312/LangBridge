import { redis } from "./redis.js";
import { sendError } from "./apiResponse.js";

const normalizeIdentifier = (value) =>
  String(value ?? "anonymous")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_");

const buildKey = (...parts) => parts.map(normalizeIdentifier).join(":");

export const getClientIp = (req) =>
  req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";

export async function consumeRateLimit({
  keyPrefix,
  identifier,
  windowSeconds,
  maxRequests,
}) {
  const key = buildKey(keyPrefix, identifier);

  const currentCount = await redis.incr(key);
  if (currentCount === 1) {
    await redis.expire(key, windowSeconds);
  }

  const ttl = await redis.ttl(key);

  return {
    allowed: currentCount <= maxRequests,
    remaining: Math.max(maxRequests - currentCount, 0),
    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}

export function createRateLimitMiddleware({
  keyPrefix,
  windowSeconds,
  maxRequests,
  message = "Too many requests. Please try again later.",
}) {
  return async (req, res, next) => {
    try {
      const identifier = `${getClientIp(req)}:${req.user?.id || req.body?.email || "guest"}`;
      const limit = await consumeRateLimit({
        keyPrefix,
        identifier,
        windowSeconds,
        maxRequests,
      });

      if (!limit.allowed) {
        return sendError(res, 429, message, {
          code: "RATE_LIMITED",
          retryAfterSeconds: limit.retryAfterSeconds,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function createBruteForceGuard({
  keyPrefix,
  message = "Too many failed attempts. Please try again later.",
}) {
  return async (req, res, next) => {
    try {
      const identifier = `${getClientIp(req)}:${req.body?.email || "guest"}`;
      const lock = await isLocked({ keyPrefix, identifier });

      if (lock.locked) {
        return sendError(res, 429, message, {
          code: "AUTH_LOCKED",
          retryAfterSeconds: lock.retryAfterSeconds,
        });
      }

      req.bruteForceKey = { keyPrefix, identifier };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export async function recordFailure({
  keyPrefix,
  identifier,
  failureWindowSeconds,
  maxFailures,
  lockWindowSeconds,
}) {
  const failureKey = buildKey(keyPrefix, "failures", identifier);
  const lockKey = buildKey(keyPrefix, "lock", identifier);

  const failures = await redis.incr(failureKey);
  if (failures === 1) {
    await redis.expire(failureKey, failureWindowSeconds);
  }

  if (failures >= maxFailures) {
    await redis.set(lockKey, "1", "EX", lockWindowSeconds);
    await redis.del(failureKey);
    return {
      locked: true,
      retryAfterSeconds: lockWindowSeconds,
    };
  }

  const ttl = await redis.ttl(failureKey);

  return {
    locked: false,
    remainingFailures: Math.max(maxFailures - failures, 0),
    retryAfterSeconds: ttl > 0 ? ttl : failureWindowSeconds,
  };
}

export async function isLocked({ keyPrefix, identifier }) {
  const lockKey = buildKey(keyPrefix, "lock", identifier);
  const ttl = await redis.ttl(lockKey);

  return {
    locked: ttl > 0,
    retryAfterSeconds: ttl > 0 ? ttl : 0,
  };
}

export async function clearBruteForceTracking({ keyPrefix, identifier }) {
  const failureKey = buildKey(keyPrefix, "failures", identifier);
  const lockKey = buildKey(keyPrefix, "lock", identifier);

  await redis.del(failureKey, lockKey);
}
