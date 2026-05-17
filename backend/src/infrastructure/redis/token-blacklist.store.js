import { redis } from "./redis.clients.js";

const blacklistKey = (token) => `bl:${token}`;

export async function blacklistToken({ token, ttlSeconds }) {
  await redis.set(blacklistKey(token), "1", "EX", ttlSeconds);
}

export async function isTokenBlacklisted(token) {
  return Boolean(await redis.get(blacklistKey(token)));
}
