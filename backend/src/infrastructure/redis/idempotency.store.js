import { redis } from "./redis.clients.js";

export async function claimIdempotencyKey({ key, ttlSeconds }) {
  const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
  return result === "OK";
}
