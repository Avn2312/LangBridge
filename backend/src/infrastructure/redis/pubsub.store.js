import { pubClient, subClient } from "./redis.clients.js";

export { pubClient, subClient };

export const getSocketPubSubClients = () => ({
  pubClient,
  subClient,
});
