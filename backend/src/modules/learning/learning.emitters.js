import { logger } from "../../core/observability/logger.js";
import { getIO } from "../../infrastructure/realtime/socket.js";
import { userRoom } from "../../infrastructure/realtime/socket.rooms.js";

export function emitNewCorrection({ senderId, receiverId, correction }) {
  try {
    const io = getIO();
    io.to(userRoom(senderId)).emit("newCorrection", correction);
    io.to(userRoom(receiverId)).emit("newCorrection", correction);
  } catch (error) {
    logger.error("Socket emit failed (newCorrection)", error);
  }
}
