import { redis } from "./redis.clients.js";

const ONLINE_USERS_KEY = "langbridge:online_users";

export const getOnlineUserIds = async () => redis.smembers(ONLINE_USERS_KEY);

export const markUserOnline = async (userId) => {
  await redis.sadd(ONLINE_USERS_KEY, userId);
};

export const markUserOffline = async (userId) => {
  await redis.srem(ONLINE_USERS_KEY, userId);
};
