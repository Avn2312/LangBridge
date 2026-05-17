import "dotenv/config";
import http from "http";
import { eventTopics } from "../infrastructure/messaging/event-topics.js";
import { getKafka } from "../infrastructure/messaging/kafka.client.js";
import { logger } from "../core/observability/logger.js";
import { connectDB } from "../infrastructure/database/mongoose.js";
import {
  incrementKafkaEvent,
  observeKafkaConsumerLag,
  renderMetrics,
} from "../core/observability/metrics.js";
import { claimIdempotencyKey } from "../infrastructure/redis/idempotency.store.js";
import { runtimeConfig } from "../config/env.js";
import { eventHandlers } from "./handlers/index.js";

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
  return claimIdempotencyKey({ key, ttlSeconds: PROCESSED_TTL_SECONDS });
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

      const handler = eventHandlers[topic];
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
