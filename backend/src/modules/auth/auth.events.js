import { publishEvent } from "../../infrastructure/messaging/event-bus.js";
import { eventTopics } from "../../infrastructure/messaging/event-topics.js";

export const publishUserSignedUp = ({ userId, email }) =>
  publishEvent({
    topic: eventTopics.userSignedUp,
    key: userId,
    payload: { userId, email },
  });

export const publishAuthNotification = ({ userId, type, actorId }) =>
  publishEvent({
    topic: eventTopics.notificationSend,
    key: userId,
    payload: { userId, type, actorId },
  });

