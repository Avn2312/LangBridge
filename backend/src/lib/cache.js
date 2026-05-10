import { redis } from "./redis.js";
import { logger } from "./logger.js";

const DEFAULT_TTL_SECONDS = 60;
const CACHE_PREFIX = "langbridge:cache";

export const cacheKeys = {
  recommendations: ({ userId, page, limit, filters = "" }) =>
    `${CACHE_PREFIX}:recommendations:${userId}:page:${page}:limit:${limit}:filters:${filters}`,
  friends: ({ userId, page, limit }) =>
    `${CACHE_PREFIX}:friends:${userId}:page:${page}:limit:${limit}`,
  conversations: ({ userId, page, limit }) =>
    `${CACHE_PREFIX}:conversations:${userId}:page:${page}:limit:${limit}`,
};

export const readJsonCache = async (key) => {
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.error("Redis cache read failed", { key, error });
    return null;
  }
};

export const writeJsonCache = async (
  key,
  value,
  ttlSeconds = DEFAULT_TTL_SECONDS,
) => {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    logger.error("Redis cache write failed", { key, error });
  }
};

export const deleteCachePatterns = async (patterns = []) => {
  if (
    typeof redis.scanStream !== "function" ||
    typeof redis.pipeline !== "function"
  ) {
    return;
  }

  for (const pattern of patterns) {
    try {
      const stream = redis.scanStream({ match: pattern, count: 100 });
      const pipeline = redis.pipeline();
      let keyCount = 0;

      await new Promise((resolve, reject) => {
        stream.on("data", (keys = []) => {
          for (const key of keys) {
            pipeline.del(key);
            keyCount += 1;
          }
        });
        stream.on("end", resolve);
        stream.on("error", reject);
      });

      if (keyCount > 0) {
        await pipeline.exec();
      }
    } catch (error) {
      logger.error("Redis cache invalidation failed", { pattern, error });
    }
  }
};

export const invalidateUserListCaches = async (userIds = []) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean).map(String))];
  const patterns = uniqueUserIds.flatMap((userId) => [
    `${CACHE_PREFIX}:recommendations:${userId}:*`,
    `${CACHE_PREFIX}:friends:${userId}:*`,
    `${CACHE_PREFIX}:conversations:${userId}:*`,
  ]);

  await deleteCachePatterns(patterns);
};

export const invalidateConversationCaches = async (userIds = []) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean).map(String))];
  const patterns = uniqueUserIds.map(
    (userId) => `${CACHE_PREFIX}:conversations:${userId}:*`,
  );

  await deleteCachePatterns(patterns);
};
