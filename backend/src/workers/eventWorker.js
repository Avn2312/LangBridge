import "dotenv/config";
import http from "http";
import { eventTopics } from "../lib/events.js";
import { getKafka } from "../lib/kafka.js";
import { logger } from "../lib/logger.js";
import { connectDB } from "../lib/db.js";
import { createCorrection } from "../lib/languageAssist.js";
import {
  incrementKafkaEvent,
  observeKafkaConsumerLag,
  renderMetrics,
} from "../lib/metrics.js";
import { redis } from "../lib/redis.js";
import { runtimeConfig } from "../lib/runtimeConfig.js";
import LearningActivity from "../models/LearningActivity.js";
import Message from "../models/Message.js";

const PROCESSED_TTL_SECONDS = 7 * 24 * 60 * 60;
const topics = Object.values(eventTopics);
let metricsServer;

const startMetricsServer = () => {
  if (!runtimeConfig.metricsPort) {
    return;
  }

  metricsServer = http.createServer((req, res) => {
    if (req.url !== "/metrics") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: "Not found" }));
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
    res.end(renderMetrics());
  });

  metricsServer.listen(runtimeConfig.metricsPort, () => {
    logger.info("Kafka worker metrics server started", {
      port: runtimeConfig.metricsPort,
    });
  });
};

const parseEvent = (message) => {
  if (!message?.value) {
    return null;
  }

  try {
    return JSON.parse(message.value.toString());
  } catch (error) {
    logger.error("Kafka worker received invalid JSON", { error });
    return null;
  }
};

const claimEvent = async (eventId) => {
  if (!eventId) {
    return false;
  }

  const key = `langbridge:kafka:processed:${eventId}`;
  const result = await redis.set(key, "1", "EX", PROCESSED_TTL_SECONDS, "NX");
  return result === "OK";
};

const handlers = {
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
  [eventTopics.userReported]: async (event) => {
    logger.warn("Worker handled moderation event", {
      eventId: event.eventId,
      reportId: event.payload?.reportId,
      reportedId: event.payload?.reportedId,
    });
  },
  [eventTopics.notificationSend]: async (event) => {
    logger.info("Worker handled notification event", {
      eventId: event.eventId,
      userId: event.payload?.userId,
      type: event.payload?.type,
      channel: event.payload?.channel,
    });
  },
  [eventTopics.aiCorrectionRequested]: async (event) => {
    const message = event.payload?.messageId
      ? await Message.findById(event.payload.messageId).lean()
      : null;
    const correction = createCorrection({
      text: message?.text || event.payload?.text,
      tone: "friendly",
    });

    if (event.payload?.userId && correction.corrected) {
      await LearningActivity.create({
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

const startWorker = async () => {
  startMetricsServer();

  if (!runtimeConfig.kafka.enabled) {
    logger.warn("Kafka worker not started because KAFKA_ENABLED is false");
    return;
  }

  await connectDB();

  const kafka = await getKafka();
  if (!kafka) {
    logger.warn("Kafka worker not started because Kafka client is unavailable");
    return;
  }

  const consumer = kafka.consumer({
    groupId: runtimeConfig.kafka.groupId,
    allowAutoTopicCreation: true,
  });

  await consumer.connect();
  await consumer.subscribe({ topics, fromBeginning: false });

  logger.info("Kafka worker started", {
    groupId: runtimeConfig.kafka.groupId,
    topics,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const highWatermark = Number(message.highWatermark);
      const offset = Number(message.offset);
      if (Number.isFinite(highWatermark) && Number.isFinite(offset)) {
        observeKafkaConsumerLag({
          topic,
          partition,
          lag: Math.max(highWatermark - offset - 1, 0),
        });
      }

      const event = parseEvent(message);
      if (!event?.eventId) {
        incrementKafkaEvent({ topic, outcome: "invalid" });
        return;
      }

      const claimed = await claimEvent(event.eventId);
      if (!claimed) {
        incrementKafkaEvent({ topic, outcome: "duplicate" });
        logger.info("Kafka worker skipped duplicate event", {
          topic,
          eventId: event.eventId,
        });
        return;
      }

      const handler = handlers[topic];
      if (!handler) {
        incrementKafkaEvent({ topic, outcome: "unhandled" });
        logger.warn("Kafka worker has no handler for topic", { topic });
        return;
      }

      await handler(event);
      incrementKafkaEvent({ topic, outcome: "handled" });
      logger.info("Kafka worker committed event handling", {
        topic,
        partition,
        offset: message.offset,
        eventId: event.eventId,
      });
    },
  });

  const shutdown = async () => {
    logger.info("Kafka worker shutting down");
    await consumer.disconnect();
    metricsServer?.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startWorker().catch((error) => {
  logger.error("Kafka worker failed", error);
  process.exit(1);
});
