import { sessionRedisClient } from "./redis.clients.js";

export { sessionRedisClient };

export const getSessionRedisClient = () => sessionRedisClient;
