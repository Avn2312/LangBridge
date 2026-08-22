import mongoose from "mongoose";
import { createAppError } from "../../core/http/api-response.js";
import { getBlockState } from "../moderation/blocking.service.js";
import {
  createContextAwareTranslation,
  createCorrection,
} from "../translation/translation.service.js";
import { emitNewCorrection } from "./learning.emitters.js";
import {
  serializeCorrectionActivity,
  serializeLearningDashboard,
} from "./learning.dto.js";
import {
  aggregateWeeklyActivityCounts,
  countSavedPhrases,
  createLearningActivity,
  findMessageById,
  findPartnerCorrectionActivities,
  findRecentActivitiesForUser,
  findRecentConversationMessages,
} from "./learning.repository.js";

const normalizeText = (value, maxLength = 2000) =>
  String(value || "").trim().slice(0, maxLength);

const normalizeObjectId = (value) => {
  if (!value) return null;
  const id = String(value);
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
};

const isValidObjectId = (value) =>
  Boolean(value) && mongoose.Types.ObjectId.isValid(value);

const appError = (statusCode, message, code) =>
  createAppError(message, statusCode, { code });

const getMessageParticipantIds = (message) => ({
  senderId: message.sender.toString(),
  receiverId: message.receiver.toString(),
});

const ensureOptionalObjectIdBodyField = ({ value, fieldName, code }) => {
  if (value && !isValidObjectId(value)) {
    throw appError(400, `${fieldName} is invalid.`, code);
  }
};

const ensureRequiredObjectIdBodyField = ({ value, fieldName, code }) => {
  if (!isValidObjectId(value)) {
    throw appError(400, `${fieldName} is invalid.`, code);
  }
};

const ensurePartnerIsNotBlocked = async ({ userId, partnerId, message, code }) => {
  if (!partnerId) return;

  const blockState = await getBlockState(userId, partnerId);
  if (blockState.isBlockedEitherWay) {
    throw appError(403, message, code);
  }
};

const resolveOwnedMessageContext = async ({
  userId,
  messageId,
  forbiddenMessage,
  forbiddenCode,
}) => {
  ensureOptionalObjectIdBodyField({
    value: messageId,
    fieldName: "messageId",
    code: "INVALID_MESSAGE_ID",
  });

  const message = await findMessageById(messageId);
  if (!message) {
    throw appError(404, "Message not found.", "MESSAGE_NOT_FOUND");
  }

  const myId = userId.toString();
  const { senderId, receiverId } = getMessageParticipantIds(message);
  if (senderId !== myId && receiverId !== myId) {
    throw appError(403, forbiddenMessage, forbiddenCode);
  }

  return {
    message,
    partnerId: senderId === myId ? receiverId : senderId,
  };
};

export async function correctMessage({ user, body }) {
  const text = normalizeText(body?.text);
  const tone = String(body?.tone || "friendly").trim();
  const messageId = body?.messageId;
  let partnerId = normalizeObjectId(body?.partnerId);
  let sourceText = text;
  let message = null;

  if (messageId) {
    const context = await resolveOwnedMessageContext({
      userId: user._id,
      messageId,
      forbiddenMessage: "You cannot correct this message.",
      forbiddenCode: "CORRECTION_FORBIDDEN",
    });
    message = context.message;
    partnerId = context.partnerId;
    sourceText = message.text;
  }

  if (!sourceText) {
    throw appError(400, "Text is required.", "CORRECTION_TEXT_REQUIRED");
  }

  if (body?.partnerId && !partnerId) {
    throw appError(400, "partnerId is invalid.", "INVALID_PARTNER_ID");
  }

  await ensurePartnerIsNotBlocked({
    userId: user._id,
    partnerId,
    message: "Cannot correct a blocked conversation.",
    code: "CORRECTION_BLOCKED",
  });

  const correction = createCorrection({ text: sourceText, tone });
  const activity = await createLearningActivity({
    user: user._id,
    partner: partnerId,
    message: message?._id || null,
    type: "correction",
    sourceText: correction.original,
    resultText: correction.corrected,
    targetLanguage: user.learningLanguage || "",
    metadata: {
      tone: correction.tone,
      explanation: correction.explanation,
      changes: correction.changes,
    },
  });

  return {
    success: true,
    correction,
    activityId: activity._id,
  };
}

export async function createPartnerCorrection({ user, body }) {
  const messageId = body?.messageId;
  const correctedText = normalizeText(body?.correctedText);
  const note = normalizeText(body?.note, 500);

  ensureRequiredObjectIdBodyField({
    value: messageId,
    fieldName: "messageId",
    code: "INVALID_MESSAGE_ID",
  });

  if (!correctedText) {
    throw appError(400, "Corrected text is required.", "CORRECTED_TEXT_REQUIRED");
  }

  const message = await findMessageById(messageId);
  if (!message) {
    throw appError(404, "Message not found.", "MESSAGE_NOT_FOUND");
  }

  const myId = user._id.toString();
  const { senderId, receiverId } = getMessageParticipantIds(message);

  if (senderId === myId) {
    throw appError(
      403,
      "You cannot partner-correct your own message.",
      "CANNOT_CORRECT_OWN_MESSAGE",
    );
  }

  if (receiverId !== myId) {
    throw appError(
      403,
      "You cannot correct this message.",
      "PARTNER_CORRECTION_FORBIDDEN",
    );
  }

  const originalText = normalizeText(message.text);
  if (!originalText) {
    throw appError(
      400,
      "Only text messages can be corrected.",
      "MESSAGE_TEXT_REQUIRED",
    );
  }

  await ensurePartnerIsNotBlocked({
    userId: user._id,
    partnerId: senderId,
    message: "Cannot correct a blocked conversation.",
    code: "CORRECTION_BLOCKED",
  });

  const activity = await createLearningActivity({
    user: senderId,
    partner: user._id,
    message: message._id,
    type: "partner_correction",
    sourceText: originalText,
    resultText: correctedText,
    targetLanguage: user.nativeLanguage || user.learningLanguage || "",
    metadata: {
      author: user._id,
      receiver: senderId,
      note,
      status: "active",
    },
  });
  const correction = serializeCorrectionActivity(activity.toObject());

  emitNewCorrection({ senderId, receiverId: myId, correction });

  return {
    success: true,
    correction,
    activityId: activity._id,
  };
}

export async function listPartnerCorrections({ userId, query }) {
  const partnerId = normalizeObjectId(query?.partnerId);

  if (query?.partnerId && !partnerId) {
    throw appError(400, "partnerId is invalid.", "INVALID_PARTNER_ID");
  }

  const activities = await findPartnerCorrectionActivities({
    userId,
    partnerId,
  });

  return {
    success: true,
    corrections: activities.map(serializeCorrectionActivity),
  };
}

export async function translateMessage({ user, body }) {
  const targetLanguage = normalizeText(
    body?.targetLanguage || user.nativeLanguage || "english",
    80,
  );
  const messageId = body?.messageId;
  let text = normalizeText(body?.text);
  let partnerId = normalizeObjectId(body?.partnerId);
  let message = null;

  if (body?.partnerId && !partnerId) {
    throw appError(400, "partnerId is invalid.", "INVALID_PARTNER_ID");
  }

  if (messageId) {
    const context = await resolveOwnedMessageContext({
      userId: user._id,
      messageId,
      forbiddenMessage: "You cannot translate this message.",
      forbiddenCode: "TRANSLATION_FORBIDDEN",
    });
    message = context.message;
    partnerId = context.partnerId;
    text = message.text;
  }

  if (!text) {
    throw appError(400, "Text is required.", "TRANSLATION_TEXT_REQUIRED");
  }

  await ensurePartnerIsNotBlocked({
    userId: user._id,
    partnerId,
    message: "Cannot translate a blocked conversation.",
    code: "TRANSLATION_BLOCKED",
  });

  const contextMessages = partnerId
    ? await findRecentConversationMessages({
        userId: user._id,
        partnerId,
        limit: 8,
      })
    : [];
  const translation = await createContextAwareTranslation({
    text,
    targetLanguage,
    contextMessages: contextMessages.reverse(),
  });
  const activity = await createLearningActivity({
    user: user._id,
    partner: partnerId,
    message: message?._id || null,
    type: "translation",
    sourceText: translation.original,
    resultText: translation.translated,
    targetLanguage: translation.targetLanguage,
    metadata: {
      confidence: translation.confidence,
      contextHint: translation.contextHint,
    },
  });

  return {
    success: true,
    translation,
    activityId: activity._id,
  };
}

export async function savePhrase({ user, body }) {
  const phrase = normalizeText(body?.phrase, 500);
  const partnerId = normalizeObjectId(body?.partnerId);
  const messageId = normalizeObjectId(body?.messageId);

  if (!phrase) {
    throw appError(400, "Phrase is required.", "PHRASE_REQUIRED");
  }

  if (body?.partnerId && !partnerId) {
    throw appError(400, "partnerId is invalid.", "INVALID_PARTNER_ID");
  }

  if (body?.messageId && !messageId) {
    throw appError(400, "messageId is invalid.", "INVALID_MESSAGE_ID");
  }

  const activity = await createLearningActivity({
    user: user._id,
    partner: partnerId,
    message: messageId,
    type: "saved_phrase",
    sourceText: phrase,
    resultText: phrase,
    targetLanguage: body?.language || user.learningLanguage || "",
  });

  return { success: true, phrase: activity };
}

export async function getLearningDashboard({ userId }) {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [recentActivities, weeklyCounts, totalSavedPhrases] =
    await Promise.all([
      findRecentActivitiesForUser({ userId, limit: 20 }),
      aggregateWeeklyActivityCounts({ userId, since }),
      countSavedPhrases(userId),
    ]);

  return serializeLearningDashboard({
    recentActivities,
    weeklyCounts,
    totalSavedPhrases,
    since,
  });
}
