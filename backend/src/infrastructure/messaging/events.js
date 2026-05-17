import crypto from "crypto";
export { eventTopics } from "./event-topics.js";

export const createEventEnvelope = ({ topic, key, payload }) => ({
  eventId: crypto.randomUUID(),
  topic,
  key: key ? String(key) : undefined,
  occurredAt: new Date().toISOString(),
  payload,
});
