import { logger } from "../../core/observability/logger.js";
import {
  getOnlineUserIds,
  markUserOffline,
  markUserOnline,
} from "../../infrastructure/redis/presence.store.js";
import { userRoom } from "../../infrastructure/realtime/socket.rooms.js";
import { getFriendIdsForUser } from "./presence.repository.js";

export { getOnlineUserIds, markUserOffline, markUserOnline };

const emitPresenceSnapshotToUser = async ({ io, recipientId }) => {
  if (!io) return;

  const [friendIds, onlineUsers] = await Promise.all([
    getFriendIdsForUser(recipientId),
    getOnlineUserIds(),
  ]);
  const visibleUserIds = new Set([recipientId, ...friendIds]);
  const scopedOnlineUsers = onlineUsers.filter((onlineUserId) =>
    visibleUserIds.has(onlineUserId),
  );

  io.to(userRoom(recipientId)).emit("onlineUsers", scopedOnlineUsers);
};

export const refreshPresenceForUsers = async ({ io, userIds = [] }) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean).map(String))];
  await Promise.all(
    uniqueUserIds.map((userId) =>
      emitPresenceSnapshotToUser({ io, recipientId: userId }).catch((error) => {
        logger.error("Friend-scoped presence refresh failed", {
          userId,
          error,
        });
      }),
    ),
  );
};

export const notifyPresenceScope = async ({ io, userId }) => {
  const friendIds = await getFriendIdsForUser(userId);
  await refreshPresenceForUsers({ io, userIds: [userId, ...friendIds] });
};
