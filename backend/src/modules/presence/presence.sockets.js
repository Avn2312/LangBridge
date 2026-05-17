import { logger } from "../../core/observability/logger.js";
import { userRoom } from "../../infrastructure/realtime/socket.rooms.js";
import {
  markUserOffline,
  markUserOnline,
  notifyPresenceScope,
} from "./presence.service.js";

export async function registerPresenceSocketHandlers({ io, socket, userId }) {
  socket.join(userRoom(userId));
  await markUserOnline(userId);
  await notifyPresenceScope({ io, userId });

  socket.on("disconnect", async (reason) => {
    logger.info("Socket disconnected", {
      userId,
      socketId: socket.id,
      reason,
    });

    const userSockets = await io.in(userRoom(userId)).fetchSockets();
    if (userSockets.length === 0) {
      await markUserOffline(userId);
      await notifyPresenceScope({ io, userId });
      logger.info("User went offline", { userId });
    }
  });
}
