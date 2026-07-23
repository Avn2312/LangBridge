import "dotenv/config";
import http from "http";
import app from "./src/app.js";
import { connectDB } from "./src/infrastructure/database/mongoose.js";
import { initSocket } from "./src/infrastructure/realtime/socket.js";
import {
  redis,
  pubClient,
  subClient,
  sessionRedisClient,
} from "./src/infrastructure/redis/redis.clients.js";
import mongoose from "mongoose";
import { logger } from "./src/core/observability/logger.js";

const PORT = process.env.PORT || 3000;
let httpServer;
let io;
let shuttingDown = false;

// ──── START SERVER ────────────────────────────────────────────────────────────
// WHY http.createServer(app) instead of app.listen()?
//   Socket.IO needs access to the raw Node.js http.Server to intercept
//   the WebSocket upgrade handshake. app.listen() creates that server
//   internally and doesn't expose it. http.createServer(app) gives us
//   a handle to pass to Socket.IO.
// INTERVIEW: "Why not just attach Socket.IO directly to Express?"
//   → "Express is just a request handler. Socket.IO sits at the
//      lower http.Server level to intercept upgrade events."
const startServer = async () => {
  await connectDB();

  // Create the raw HTTP server and wrap Express as its request handler
  httpServer = http.createServer(app);

  // Initialize Socket.IO on the http server (attaches Redis adapter inside)
  io = initSocket(httpServer);

  // Now bind to port — Socket.IO is ready before any connections arrive
  httpServer.listen(PORT, () => {
    logger.info("Server is running", { port: PORT });
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("Shutdown requested", { signal });

  const closeTasks = [];

  if (io) {
    closeTasks.push(Promise.resolve().then(() => io.close()));
  }

  if (httpServer) {
    closeTasks.push(
      new Promise((resolve) => {
        httpServer.close(() => resolve());
      }),
    );
  }

  closeTasks.push(mongoose.disconnect());
  closeTasks.push(
    Promise.resolve().then(() => redis.quit?.() ?? redis.disconnect?.()),
  );
  closeTasks.push(
    Promise.resolve().then(
      () => pubClient.quit?.() ?? pubClient.disconnect?.(),
    ),
  );
  closeTasks.push(
    Promise.resolve().then(
      () => subClient.quit?.() ?? subClient.disconnect?.(),
    ),
  );
  closeTasks.push(
    Promise.resolve().then(
      () => sessionRedisClient.quit?.() ?? sessionRedisClient.disconnect?.(),
    ),
  );

  await Promise.allSettled(closeTasks);
  process.exit(0);
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

startServer().catch((error) => {
  logger.error("Failed to start server", error);
  process.exit(1);
});
