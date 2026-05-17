import { logger } from "../../core/observability/logger.js";
import {
  getOnlineUserIds as getPresenceOnlineUserIds,
  refreshPresenceForUsers as refreshPresence,
} from "../../modules/presence/presence.service.js";
import { authenticateSocket } from "./socket.auth.js";
import { registerSocketHandlers } from "./socket.registry.js";
import { createSocketServer } from "./socket.server.js";

// ─── Module-level io reference ────────────────────────────────────────────────
// Exported via getIO() so other modules (e.g. user.controller) can emit events
// without importing Socket.IO at startup (avoids circular dependency issues).
let io;

export const getIO = () => {
  if (!io)
    throw new Error("Socket.IO not initialized — call initSocket first.");
  return io;
};

export const getOnlineUserIds = getPresenceOnlineUserIds;

export const refreshPresenceForUsers = async (userIds = []) =>
  refreshPresence({ io, userIds });

export const initSocket = (httpServer) => {
  io = createSocketServer(httpServer);
  io.use(authenticateSocket);
  registerSocketHandlers({ io });

  logger.info("Socket.IO initialized with Redis adapter");
  return io;
};
