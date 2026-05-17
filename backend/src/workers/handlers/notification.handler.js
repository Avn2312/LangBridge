import { eventTopics } from "../../infrastructure/messaging/event-topics.js";
import { logger } from "../../core/observability/logger.js";

export const notificationHandlers = {
  [eventTopics.notificationSend]: async (event) => {
    logger.info("Worker handled notification event", {
      eventId: event.eventId,
      userId: event.payload?.userId,
      type: event.payload?.type,
      channel: event.payload?.channel,
    });
  },
};
