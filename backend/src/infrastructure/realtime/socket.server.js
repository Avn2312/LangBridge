import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { runtimeConfig } from "../../config/env.js";
import { getSocketPubSubClients } from "../redis/pubsub.store.js";

export const createSocketServer = (httpServer) => {
  const allowedOrigins = new Set([
    ...runtimeConfig.corsOrigins,
    runtimeConfig.frontendUrl,
    runtimeConfig.baseUrl,
    process.env.RENDER_EXTERNAL_URL,
  ].filter(Boolean));

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (
          !origin ||
          allowedOrigins.has(origin) ||
          origin.endsWith(".onrender.com")
        ) {
          return callback(null, true);
        }

        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["polling", "websocket"],
  });

  if (process.env.NODE_ENV !== "test") {
    const { pubClient, subClient } = getSocketPubSubClients();
    io.adapter(createAdapter(pubClient, subClient));
  }

  return io;
};
