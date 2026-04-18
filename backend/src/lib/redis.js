import Redis from "ioredis";
import { createClient } from "redis";

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

// Main Redis client — used for general commands (SET, GET, etc.)
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
    });

const sessionRedisClient = createClient(
  process.env.REDIS_URL
    ? { url: process.env.REDIS_URL }
    : {
        socket: {
          host: redisHost,
          port: redisPort,
        },
        password: redisPassword,
      },
);

redis.on("connect", () => {
  console.log("✅ Connected to Redis successfully.");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

sessionRedisClient.on("connect", () => {
  console.log("✅ Connected to Redis session store.");
});

sessionRedisClient.on("error", (err) => {
  console.error("❌ Redis session store error:", err);
});

sessionRedisClient.connect().catch((err) => {
  console.error("❌ Failed to connect Redis session store:", err);
});

export { redis, sessionRedisClient, Redis };
