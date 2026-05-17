import { getBlockState } from "../moderation/blocking.service.js";
import {
  cacheKeys,
  invalidateConversationCaches,
  readJsonCache,
  writeJsonCache,
} from "../../infrastructure/redis/cache.store.js";
import { consumeRateLimit } from "../../infrastructure/redis/rate-limit.store.js";
import { runtimeConfig } from "../../config/env.js";
import { eventTopics } from "../../infrastructure/messaging/event-topics.js";
import { publishEvent } from "../../infrastructure/messaging/event-bus.js";
import {
  getPagination,
} from "../../core/http/pagination.js";
import {
  serializeConversationsResult,
  serializeMessagesResult,
  serializeRealtimeMessageResult,
} from "./chat.dto.js";
import {
  aggregateConversationsForUser,
  createMessage,
  findMessageByClientMessageId,
  findMessagesBetweenUsers,
  markMessagesReadAt,
  markMessagesRead,
} from "./chat.repository.js";

const MAX_CLIENT_MESSAGE_ID_LENGTH = 64;
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_URL_LENGTH = 2048;
const MAX_ATTACHMENT_FILENAME_LENGTH = 255;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set(["image", "file", "audio"]);

const normalizeClientMessageId = (value) => {
  const id = String(value || "").trim();
  if (!id || id.length > MAX_CLIENT_MESSAGE_ID_LENGTH) {
    return null;
  }
  return id;
};

const normalizeAttachments = (value) => {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_ATTACHMENTS) return null;

  const normalized = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const url = String(entry.url || "").trim();
    const type = ALLOWED_ATTACHMENT_TYPES.has(entry.type) ? entry.type : "file";
    const filename = String(entry.filename || "").trim();
    const size = Number(entry.size || 0);

    if (!url || url.length > MAX_ATTACHMENT_URL_LENGTH) {
      return null;
    }

    if (filename.length > MAX_ATTACHMENT_FILENAME_LENGTH) {
      return null;
    }

    if (!Number.isFinite(size) || size < 0 || size > MAX_ATTACHMENT_BYTES) {
      return null;
    }

    normalized.push({
      url,
      type,
      filename,
      size,
    });
  }

  return normalized;
};

export async function listMessagesWithUser({ viewerId, otherUserId, query }) {
  const { page, limit, skip } = getPagination(query, {
    defaultLimit: 50,
    maxLimit: 100,
  });

  const blockState = await getBlockState(viewerId, otherUserId);
  if (blockState.isBlockedEitherWay) {
    const error = new Error(
      "Cannot access messages because one user has blocked the other.",
    );
    error.statusCode = 403;
    error.code = "MESSAGES_BLOCKED";
    error.details = {
      isBlockedByMe: blockState.isBlockedByViewer,
      hasBlockedMe: blockState.hasBlockedViewer,
    };
    throw error;
  }

  const { messages, total } = await findMessagesBetweenUsers({
    viewerId,
    otherUserId,
    skip,
    limit,
  });

  markMessagesRead({ senderId: otherUserId, receiverId: viewerId });

  return serializeMessagesResult({ messages, page, limit, total });
}

export async function listConversations({ userId, query }) {
  const { page, limit, skip } = getPagination(query, {
    defaultLimit: 20,
    maxLimit: 100,
  });
  const cacheKey = cacheKeys.conversations({
    userId: userId.toString(),
    page,
    limit,
  });

  const cached = await readJsonCache(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await aggregateConversationsForUser({ userId, skip, limit });
  const payload = serializeConversationsResult({
    conversations: result.conversations,
    page,
    limit,
    total: result.total,
  });

  await writeJsonCache(cacheKey, payload, 30);
  return payload;
}

export async function sendRealtimeMessage({
  senderId,
  socketId,
  payload = {},
}) {
  const { receiverId, text, attachments, clientMessageId } = payload;
  const rateLimit = await consumeRateLimit({
    keyPrefix: "rate:socket:send-message",
    identifier: `${senderId}:${socketId}`,
    windowSeconds: runtimeConfig.rateLimit.messageWindowSeconds,
    maxRequests: runtimeConfig.rateLimit.messageMaxRequests,
  });

  if (!rateLimit.allowed) {
    return {
      ok: false,
      emitError: true,
      code: "MESSAGE_RATE_LIMITED",
      message: "Too many messages. Please slow down.",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const trimmedText = text?.trim();
  const normalizedAttachments = normalizeAttachments(attachments);

  if (attachments != null && normalizedAttachments == null) {
    return {
      ok: false,
      code: "INVALID_ATTACHMENTS",
      message: "attachments payload is invalid.",
    };
  }

  if (!receiverId || (!trimmedText && normalizedAttachments.length === 0)) {
    return {
      ok: false,
      code: "INVALID_MESSAGE_PAYLOAD",
      message: "receiverId and at least one of text/attachments are required.",
    };
  }

  const blockState = await getBlockState(senderId, receiverId);
  if (blockState.isBlockedEitherWay) {
    return {
      ok: false,
      emitError: true,
      code: "MESSAGE_BLOCKED",
      message: "Cannot send message because one user has blocked the other.",
      isBlockedByMe: blockState.isBlockedByViewer,
      hasBlockedMe: blockState.hasBlockedViewer,
    };
  }

  const normalizedClientMessageId = normalizeClientMessageId(clientMessageId);
  if (clientMessageId && !normalizedClientMessageId) {
    return {
      ok: false,
      code: "INVALID_CLIENT_MESSAGE_ID",
      message: "clientMessageId is invalid.",
    };
  }

  let message = null;
  let reusedExistingMessage = false;

  if (normalizedClientMessageId) {
    message = await findMessageByClientMessageId({
      senderId,
      clientMessageId: normalizedClientMessageId,
    });
  }

  if (!message) {
    try {
      message = await createMessage({
        senderId,
        receiverId,
        text: trimmedText || "",
        attachments: normalizedAttachments,
        clientMessageId: normalizedClientMessageId,
      });
    } catch (dbError) {
      const duplicateClientId =
        dbError?.code === 11000 &&
        normalizedClientMessageId &&
        dbError?.keyPattern?.sender &&
        dbError?.keyPattern?.clientMessageId;

      if (!duplicateClientId) {
        throw dbError;
      }

      message = await findMessageByClientMessageId({
        senderId,
        clientMessageId: normalizedClientMessageId,
      });

      if (!message) {
        throw dbError;
      }
    }
  } else {
    reusedExistingMessage = true;
  }

  if (!reusedExistingMessage) {
    await invalidateConversationCaches([senderId, receiverId]);
    publishEvent({
      topic: eventTopics.messageSent,
      key: message._id.toString(),
      payload: {
        messageId: message._id.toString(),
        senderId,
        receiverId,
        hasText: Boolean(message.text),
        attachmentCount: message.attachments?.length || 0,
        clientMessageId: message.clientMessageId || null,
      },
    });

    if (runtimeConfig.ai.autoCorrectionEvents && message.text) {
      publishEvent({
        topic: eventTopics.aiCorrectionRequested,
        key: message._id.toString(),
        payload: {
          messageId: message._id.toString(),
          userId: senderId,
          text: message.text,
          receiverId,
        },
      });
    }
  }

  return serializeRealtimeMessageResult({
    code: reusedExistingMessage ? "DUPLICATE_REPLAY" : "SENT",
    receiverId,
    message,
    wasDuplicate: reusedExistingMessage,
  });
}

export async function canEmitTypingIndicator({
  senderId,
  receiverId,
  socketId,
}) {
  if (!receiverId) {
    return false;
  }

  const blockState = await getBlockState(senderId, receiverId);
  if (blockState.isBlockedEitherWay) {
    return false;
  }

  const rateLimit = await consumeRateLimit({
    keyPrefix: "rate:socket:typing",
    identifier: `${senderId}:${socketId}`,
    windowSeconds: runtimeConfig.rateLimit.typingWindowSeconds,
    maxRequests: runtimeConfig.rateLimit.typingMaxRequests,
  });

  return rateLimit.allowed;
}

export async function canEmitStopTyping({ senderId, receiverId }) {
  if (!receiverId) {
    return false;
  }

  const blockState = await getBlockState(senderId, receiverId);
  return !blockState.isBlockedEitherWay;
}

export async function markConversationReadRealtime({ readerId, senderId }) {
  const readAt = new Date();
  const result = await markMessagesReadAt({
    senderId,
    receiverId: readerId,
    readAt,
  });

  await invalidateConversationCaches([readerId, senderId]);

  if (result.modifiedCount > 0) {
    publishEvent({
      topic: eventTopics.messageRead,
      key: `${senderId}:${readerId}`,
      payload: {
        senderId,
        readerId,
        readAt: readAt.toISOString(),
        messageCount: result.modifiedCount,
      },
    });
  }

  return {
    readAt,
    modifiedCount: result.modifiedCount || 0,
  };
}
