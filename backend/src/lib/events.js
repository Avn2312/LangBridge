import crypto from "crypto";

export const eventTopics = {
  userSignedUp: "user.signed_up",
  friendRequestCreated: "friend_request.created",
  messageSent: "message.sent",
  messageRead: "message.read",
  userReported: "user.reported",
  notificationSend: "notification.send",
  aiCorrectionRequested: "ai.correction.requested",
};

export const createEventEnvelope = ({ topic, key, payload }) => ({
  eventId: crypto.randomUUID(),
  topic,
  key: key ? String(key) : undefined,
  occurredAt: new Date().toISOString(),
  payload,
});
