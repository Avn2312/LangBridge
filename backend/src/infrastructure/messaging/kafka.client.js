import { logger } from "../../core/observability/logger.js";
import { runtimeConfig } from "../../config/env.js";

let kafka;
let producer;
let connectPromise;

export const isKafkaEnabled = () =>
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

export const disconnectKafkaProducer = async () => {
  if (!producer) {
    return;
  }

  await producer.disconnect();
  producer = null;
  connectPromise = null;
};

