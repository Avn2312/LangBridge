import mongoose from "mongoose";
import { redis, sessionRedisClient } from "./redis.js";

const checkRedisClient = async (client) => {
  if (!client || typeof client.ping !== "function") {
    return "unknown";
  }

  const response = await client.ping();
  return response === "PONG" || response === "pong" ? "ok" : "degraded";
};

export const getLiveness = () => ({
  status: "ok",
  service: "langbridge-api",
  timestamp: new Date().toISOString(),
  uptimeSeconds: Math.round(process.uptime()),
});

export const getReadiness = async () => {
  const mongoReady = mongoose.connection.readyState === 1;
  const [redisStatus, sessionRedisStatus] = await Promise.allSettled([
    checkRedisClient(redis),
    checkRedisClient(sessionRedisClient),
  ]);

  const dependencies = {
    mongo: mongoReady ? "ok" : "degraded",
    redis:
      redisStatus.status === "fulfilled" ? redisStatus.value : "degraded",
    sessionRedis:
      sessionRedisStatus.status === "fulfilled"
        ? sessionRedisStatus.value
        : "degraded",
  };

  const isReady = Object.values(dependencies).every((status) =>
    ["ok", "unknown"].includes(status),
  );

  return {
    status: isReady ? "ok" : "degraded",
    service: "langbridge-api",
    timestamp: new Date().toISOString(),
    dependencies,
  };
};
