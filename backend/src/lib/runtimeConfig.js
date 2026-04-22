const DEFAULT_FRONTEND_URL = "http://localhost:5173";
const DEFAULT_BASE_URL = "http://localhost:3000";

const parseBoolean = (value, fallback = false) => {
  if (value == null) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseList = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const runtimeConfig = {
  baseUrl: process.env.BASE_URL || DEFAULT_BASE_URL,
  frontendUrl: process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL,
  corsOrigins: parseList(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN, [
    DEFAULT_FRONTEND_URL,
  ]),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || "10kb",
  session: {
    name: process.env.SESSION_COOKIE_NAME || "lb.sid",
    secret:
      process.env.SESSION_SECRET ||
      process.env.JWT_SECRET_KEY ||
      "dev-session-secret-change-me",
    sameSite:
      process.env.SESSION_COOKIE_SAMESITE ||
      (process.env.NODE_ENV === "production" ? "none" : "lax"),
    secure: parseBoolean(
      process.env.SESSION_COOKIE_SECURE,
      process.env.NODE_ENV === "production",
    ),
    domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
    maxAgeMs: parseInteger(
      process.env.SESSION_COOKIE_MAX_AGE_MS,
      7 * 24 * 60 * 60 * 1000,
    ),
    ttlSeconds: parseInteger(process.env.SESSION_TTL_SECONDS, 7 * 24 * 60 * 60),
  },
  rateLimit: {
    authWindowSeconds: parseInteger(
      process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      15 * 60,
    ),
    authMaxRequests: parseInteger(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10),
    authLockWindowSeconds: parseInteger(
      process.env.AUTH_LOCK_WINDOW_SECONDS,
      15 * 60,
    ),
    authMaxFailures: parseInteger(process.env.AUTH_MAX_FAILURES, 5),
    resendWindowSeconds: parseInteger(
      process.env.RESEND_RATE_LIMIT_WINDOW_SECONDS,
      60 * 60,
    ),
    resendMaxRequests: parseInteger(
      process.env.RESEND_RATE_LIMIT_MAX_REQUESTS,
      5,
    ),
    messageWindowSeconds: parseInteger(
      process.env.MESSAGE_RATE_LIMIT_WINDOW_SECONDS,
      60,
    ),
    messageMaxRequests: parseInteger(
      process.env.MESSAGE_RATE_LIMIT_MAX_REQUESTS,
      30,
    ),
    typingWindowSeconds: parseInteger(
      process.env.TYPING_RATE_LIMIT_WINDOW_SECONDS,
      10,
    ),
    typingMaxRequests: parseInteger(
      process.env.TYPING_RATE_LIMIT_MAX_REQUESTS,
      60,
    ),
  },
};

export const getFrontendUrl = () =>
  runtimeConfig.frontendUrl.replace(/\/$/, "");
export const getBaseUrl = () => runtimeConfig.baseUrl.replace(/\/$/, "");
