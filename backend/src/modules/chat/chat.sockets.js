import { logger } from "../../core/observability/logger.js";
import {
  incrementSocketRetry,
  observeSocketAckLatency,
} from "../../core/observability/metrics.js";
import {
  canEmitStopTyping,
  canEmitTypingIndicator,
  markConversationReadRealtime,
  sendRealtimeMessage,
} from "./chat.service.js";
import {
  emitMessagesRead,
  emitNewMessage,
  emitSocketError,
  emitStopTyping,
  emitTyping,
} from "./chat.emitters.js";

export function registerChatSocketHandlers({ io, socket, userId }) {
  socket.on("sendMessage", async (payload = {}, ackArg) => {
    const startedAt = Date.now();
    const clientAck = typeof ackArg === "function" ? ackArg : () => {};
    const ack = (response = {}) => {
      observeSocketAckLatency({
        event: "sendMessage",
        ok: response.ok === true,
        durationMs: Date.now() - startedAt,
      });

      clientAck(response);
    };

    try {
      const result = await sendRealtimeMessage({
        senderId: userId,
        socketId: socket.id,
        payload,
      });

      if (!result.ok) {
        if (result.emitError) {
          emitSocketError(socket, {
            message: result.message,
            code: result.code,
            retryAfterSeconds: result.retryAfterSeconds,
          });
        }

        ack(result);
        return;
      }

      if (result.wasDuplicate) {
        incrementSocketRetry({
          event: "sendMessage",
          reason: "duplicate_client_message_id",
        });
      }

      emitNewMessage(io, {
        receiverId: result.receiverId,
        senderId: userId,
        message: result.message,
      });

      ack({
        ok: true,
        code: result.code,
        message: result.message,
        messageId: result.messageId,
        clientMessageId: result.clientMessageId,
        wasDuplicate: result.wasDuplicate,
      });

      logger.info("Socket message saved", {
        senderId: userId,
        receiverId: result.receiverId,
        messageId: result.messageId,
        clientMessageId: result.clientMessageId,
        wasDuplicate: result.wasDuplicate,
      });
    } catch (error) {
      logger.error("sendMessage error", {
        error,
        userId,
        socketId: socket.id,
      });
      ack({
        ok: false,
        code: "SEND_MESSAGE_FAILED",
        message: "Failed to send message.",
      });
      emitSocketError(socket, { message: "Failed to send message." });
    }
  });

  socket.on("typing", ({ receiverId } = {}) => {
    canEmitTypingIndicator({
      senderId: userId,
      receiverId,
      socketId: socket.id,
    })
      .then((allowed) => {
        if (allowed) {
          emitTyping(socket, { receiverId, senderId: userId });
        }
      })
      .catch((error) => {
        logger.error("typing rate limit error", {
          error,
          userId,
          socketId: socket.id,
        });
      });
  });

  socket.on("stopTyping", ({ receiverId } = {}) => {
    canEmitStopTyping({ senderId: userId, receiverId })
      .then((allowed) => {
        if (allowed) {
          emitStopTyping(socket, { receiverId, senderId: userId });
        }
      })
      .catch((error) => {
        logger.error("stopTyping block check error", {
          error,
          userId,
          receiverId,
          socketId: socket.id,
        });
      });
  });

  socket.on("markAsRead", async ({ senderId } = {}) => {
    try {
      if (!senderId) {
        return;
      }

      const { readAt } = await markConversationReadRealtime({
        readerId: userId,
        senderId,
      });

      emitMessagesRead(io, {
        senderId,
        readBy: userId,
        readAt,
      });
    } catch (error) {
      logger.error("markAsRead error", {
        error,
        userId,
        senderId,
        socketId: socket.id,
      });
    }
  });
}
