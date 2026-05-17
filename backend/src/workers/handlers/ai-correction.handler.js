import { eventTopics } from "../../infrastructure/messaging/event-topics.js";
import { logger } from "../../core/observability/logger.js";
import { createCorrection } from "../../modules/translation/translation.service.js";
import {
  createLearningActivity,
  findMessageById,
} from "../../modules/learning/learning.repository.js";

export const aiCorrectionHandlers = {
  [eventTopics.aiCorrectionRequested]: async (event) => {
    const message = event.payload?.messageId
      ? await findMessageById(event.payload.messageId)
      : null;
    const correction = createCorrection({
      text: message?.text || event.payload?.text,
      tone: "friendly",
    });

    if (event.payload?.userId && correction.corrected) {
      await createLearningActivity({
        user: event.payload.userId,
        partner: event.payload?.receiverId || null,
        message: event.payload?.messageId || null,
        type: "correction",
        sourceText: correction.original,
        resultText: correction.corrected,
        metadata: {
          source: "kafka_worker",
          explanation: correction.explanation,
          changes: correction.changes,
        },
      });
    }

    logger.info("Worker handled AI correction request", {
      eventId: event.eventId,
      messageId: event.payload?.messageId,
      userId: event.payload?.userId,
    });
  },
};
