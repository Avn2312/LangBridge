import "dotenv/config";
import http from "http";
import app from "./src/app.js";
import { connectDB } from "./src/lib/db.js";
import { initSocket } from "./src/lib/socket.js";
import { logger } from "./src/lib/logger.js";

const PORT = process.env.PORT || 3000;

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
  const httpServer = http.createServer(app);

  // Initialize Socket.IO on the http server (attaches Redis adapter inside)
  initSocket(httpServer);

  // Now bind to port — Socket.IO is ready before any connections arrive
  httpServer.listen(PORT, () => {
    logger.info("Server is running", { port: PORT });
  });
};

startServer().catch((error) => {
  logger.error("Failed to start server", error);
  process.exit(1);
});
