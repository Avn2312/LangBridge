import { publishEvent } from "../../infrastructure/messaging/event-bus.js";
import { eventTopics } from "../../infrastructure/messaging/event-topics.js";

export const publishFriendRequestCreated = ({ requestId, senderId, recipientId }) =>
  publishEvent({
    topic: eventTopics.friendRequestCreated,
    key: requestId,
    payload: { requestId, senderId, recipientId },
  });

export const publishFriendshipNotification = ({
  userId,
  type,
  actorId,
  requestId,
}) =>
  publishEvent({
    topic: eventTopics.notificationSend,
    key: userId,
    payload: { userId, type, actorId, requestId },
  });

