import { eventTopics } from "../../infrastructure/messaging/event-topics.js";
import { logger } from "../../core/observability/logger.js";

export const analyticsHandlers = {
  [eventTopics.userSignedUp]: async (event) => {
    logger.info("Worker handled signup analytics event", {
      eventId: event.eventId,
      userId: event.payload?.userId,
      provider: event.payload?.provider,
    });
  },
  [eventTopics.friendRequestCreated]: async (event) => {
    logger.info("Worker handled friend request event", {
      eventId: event.eventId,
      requestId: event.payload?.requestId,
      recipientId: event.payload?.recipientId,
    });
  },
  [eventTopics.messageSent]: async (event) => {
    logger.info("Worker handled message analytics event", {
      eventId: event.eventId,
      messageId: event.payload?.messageId,
      attachmentCount: event.payload?.attachmentCount,
    });
  },
  [eventTopics.messageRead]: async (event) => {
    logger.info("Worker handled read receipt analytics event", {
      eventId: event.eventId,
      readerId: event.payload?.readerId,
      messageCount: event.payload?.messageCount,
    });
  },
};
