import { buildPaginationMeta } from "../../core/http/pagination.js";

export const serializeMessagesResult = ({ messages, page, limit, total }) => ({
  success: true,
  messages: messages.reverse(),
  pagination: buildPaginationMeta({ page, limit, total }),
});

export const serializeConversationsResult = ({
  conversations,
  page,
  limit,
  total,
}) => ({
  success: true,
  conversations,
  pagination: buildPaginationMeta({
    page,
    limit,
    total,
  }),
});

export const serializeRealtimeMessageResult = ({
  code,
  receiverId,
  message,
  wasDuplicate,
}) => ({
  ok: true,
  code,
  receiverId,
  message,
  messageId: message._id,
  clientMessageId: message.clientMessageId || null,
  wasDuplicate,
});
