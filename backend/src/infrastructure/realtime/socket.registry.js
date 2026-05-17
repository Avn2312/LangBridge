import { logger } from "../../core/observability/logger.js";
import { registerCallSocketHandlers } from "../../modules/calls/calls.sockets.js";
import { registerChatSocketHandlers } from "../../modules/chat/chat.sockets.js";
import { registerPresenceSocketHandlers } from "../../modules/presence/presence.sockets.js";

export const registerSocketHandlers = ({ io }) => {
  io.on("connection", async (socket) => {
    const userId = socket.userId;
    logger.info("Socket connected", { userId, socketId: socket.id });

    await registerPresenceSocketHandlers({ io, socket, userId });
    registerChatSocketHandlers({ io, socket, userId });
    registerCallSocketHandlers({ socket, userId });
  });
};
