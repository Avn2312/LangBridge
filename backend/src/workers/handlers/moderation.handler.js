import { eventTopics } from "../../infrastructure/messaging/event-topics.js";
import { logger } from "../../core/observability/logger.js";

export const moderationHandlers = {
  [eventTopics.userReported]: async (event) => {
    logger.warn("Worker handled moderation event", {
      eventId: event.eventId,
      reportId: event.payload?.reportId,
      reportedId: event.payload?.reportedId,
    });
  },
};
