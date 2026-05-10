import { createEventEnvelope } from "./events.js";
import { logger } from "./logger.js";
import { incrementKafkaPublish } from "./metrics.js";
import { runtimeConfig } from "./runtimeConfig.js";

let kafka;
let producer;
let connectPromise;

const isKafkaEnabled = () =>
  runtimeConfig.kafka.enabled && runtimeConfig.nodeEnv !== "test";

const getKafkaModule = async () => {
  try {
    return await import("kafkajs");
  } catch (error) {
    logger.warn("Kafka disabled because kafkajs is not installed", {
      error,
    });
    return null;
  }
};

export const getKafka = async () => {
  if (!isKafkaEnabled()) {
    return null;
  }

  if (kafka) {
    return kafka;
  }

  const kafkaModule = await getKafkaModule();
  if (!kafkaModule) {
    return null;
  }

  kafka = new kafkaModule.Kafka({
    clientId: runtimeConfig.kafka.clientId,
    brokers: runtimeConfig.kafka.brokers,
    retry: {
      retries: runtimeConfig.kafka.retries,
    },
  });

  return kafka;
};

export const getKafkaProducer = async () => {
  const client = await getKafka();
  if (!client) {
    return null;
  }

  if (producer) {
    return producer;
  }

  producer = client.producer({
    allowAutoTopicCreation: true,
    idempotent: false,
  });

  connectPromise ||= producer.connect();
  await connectPromise;

  return producer;
};

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

export const disconnectKafkaProducer = async () => {
  if (!producer) {
    return;
  }

  await producer.disconnect();
  producer = null;
  connectPromise = null;
};
