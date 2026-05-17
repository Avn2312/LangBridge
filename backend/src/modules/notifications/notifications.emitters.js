import { logger } from "../../core/observability/logger.js";
import { getIO } from "../../infrastructure/realtime/socket.js";
import { userRoom } from "../../infrastructure/realtime/socket.rooms.js";

export function emitFriendRequestReceived({ recipientId, request, sender }) {
  try {
    getIO()
      .to(userRoom(recipientId))
      .emit("friendRequest", {
        type: "received",
        request: {
          _id: request._id,
          sender: {
            _id: sender._id,
            fullName: sender.fullName,
            profilePic: sender.profilePic,
          },
          status: "pending",
          createdAt: request.createdAt,
        },
      });
  } catch (error) {
    logger.error("Socket emit failed (friendRequest)", error);
  }
}

export function emitFriendRequestAccepted({ senderId, acceptedBy }) {
  try {
    getIO()
      .to(userRoom(senderId))
      .emit("friendRequest", {
        type: "accepted",
        acceptedBy: {
          _id: acceptedBy._id,
          fullName: acceptedBy.fullName,
          profilePic: acceptedBy.profilePic,
        },
      });
  } catch (error) {
    logger.error("Socket emit failed (acceptFriend)", error);
  }
}
