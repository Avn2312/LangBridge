import { createEventEnvelope } from "./events.js";
import { getKafkaProducer, isKafkaEnabled } from "./kafka.client.js";
import { logger } from "../../core/observability/logger.js";
import { incrementKafkaPublish } from "../../core/observability/metrics.js";

export const publishEvent = async ({ topic, key, payload }) => {
  if (!isKafkaEnabled()) {
    return null;
  }

  const event = createEventEnvelope({ topic, key, payload });

  try {
    const kafkaProducer = await getKafkaProducer();
    if (!kafkaProducer) {
      return null;
    }

    await kafkaProducer.send({
      topic,
      messages: [
        {
          key: event.key,
          value: JSON.stringify(event),
          headers: {
            eventId: event.eventId,
            occurredAt: event.occurredAt,
          },
        },
      ],
    });

    logger.info("Kafka event published", {
      topic,
      eventId: event.eventId,
      key: event.key,
    });
    incrementKafkaPublish({ topic, outcome: "published" });
    return event;
  } catch (error) {
    incrementKafkaPublish({ topic, outcome: "failed" });
    logger.error("Kafka publish failed", {
      topic,
      key,
      error,
    });
    return null;
  }
};

