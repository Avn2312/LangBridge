import { publishEvent } from "../../infrastructure/messaging/event-bus.js";
import { eventTopics } from "../../infrastructure/messaging/event-topics.js";

export const publishNotification = ({ userId, type, actorId, requestId }) =>
  publishEvent({
    topic: eventTopics.notificationSend,
    key: userId,
    payload: { userId, type, actorId, requestId },
  });

