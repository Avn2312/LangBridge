import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import { pubClient, subClient, redis } from "./redis.js";
import { logger } from "./logger.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { runtimeConfig } from "./runtimeConfig.js";
import { consumeRateLimit } from "./rateLimit.js";
import { getBlockState } from "./blocking.js";
import { invalidateConversationCaches } from "./cache.js";
import { eventTopics } from "./events.js";
import { publishEvent } from "./kafka.js";
import {
  incrementSocketRetry,
  observeSocketAckLatency,
} from "./metrics.js";

// ─── Module-level io reference ────────────────────────────────────────────────
// Exported via getIO() so other modules (e.g. user.controller) can emit events
// without importing Socket.IO at startup (avoids circular dependency issues).
let io;

export const getIO = () => {
  if (!io)
    throw new Error("Socket.IO not initialized — call initSocket first.");
  return io;
};

// ─── Cookie parser (lightweight, no external dep) ─────────────────────────────
const parseCookieHeader = (cookieHeader = "") => {
  return cookieHeader.split(";").reduce((acc, pair) => {
    const [key, ...val] = pair.trim().split("=");
    if (key) acc[key.trim()] = decodeURIComponent(val.join("=").trim());
    return acc;
  }, {});
};

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
    const type = ALLOWED_ATTACHMENT_TYPES.has(entry.type)
      ? entry.type
      : "file";
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

// ─── Redis keys ───────────────────────────────────────────────────────────────
const ONLINE_USERS_KEY = "langbridge:online_users"; // Redis Set of online userIds

export const getOnlineUserIds = async () => redis.smembers(ONLINE_USERS_KEY);

const getFriendIds = async (userId) => {
  const user = await User.findById(userId).select("friends").lean();
  return (user?.friends || []).map((friendId) => friendId.toString());
};

const emitPresenceSnapshotToUser = async (recipientId) => {
  if (!io) return;

  const [friendIds, onlineUsers] = await Promise.all([
    getFriendIds(recipientId),
    redis.smembers(ONLINE_USERS_KEY),
  ]);
  const visibleUserIds = new Set([recipientId, ...friendIds]);
  const scopedOnlineUsers = onlineUsers.filter((onlineUserId) =>
    visibleUserIds.has(onlineUserId),
  );

  io.to(recipientId).emit("onlineUsers", scopedOnlineUsers);
};

export const refreshPresenceForUsers = async (userIds = []) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean).map(String))];
  await Promise.all(
    uniqueUserIds.map((userId) =>
      emitPresenceSnapshotToUser(userId).catch((error) => {
        logger.error("Friend-scoped presence refresh failed", {
          userId,
          error,
        });
      }),
    ),
  );
};

const notifyPresenceScope = async (userId) => {
  const friendIds = await getFriendIds(userId);
  await refreshPresenceForUsers([userId, ...friendIds]);
};

// ─── Initialize Socket.IO ─────────────────────────────────────────────────────
// Called once from server.js with the raw http.Server instance.
// INTERVIEW: "Why attach Socket.IO to the http server, not the express app?"
//   → socket.io needs to intercept the HTTP upgrade handshake
//     (WebSocket starts as an HTTP request then upgrades).
//     Express app doesn't expose the raw server; http.createServer does.
export const initSocket = (httpServer) => {
  const allowedOrigins = new Set([
    ...runtimeConfig.corsOrigins,
    runtimeConfig.frontendUrl,
  ]);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true, // allow cookies to be sent with WS handshake
      methods: ["GET", "POST"],
    },
    // INTERVIEW: "What transports do you support?"
    //   → "polling first (fallback), then upgrades to websocket.
    //      polling ensures it works behind proxies that block WS."
    transports: ["polling", "websocket"],
  });

  // ─── Attach Redis Pub/Sub Adapter ──────────────────────────────────────────
  // WHY: With only one server process, Socket.IO works fine in memory.
  //      But once you add a second server (horizontal scaling), sockets on
  //      server A can't reach clients on server B — they're in separate processes.
  //      The Redis adapter bridges this: when server A emits to a room,
  //      it publishes to Redis → server B reads from Redis → forwards to its clients.
  // INTERVIEW: "How do you scale WebSockets?"
  //   → "Redis pub/sub adapter — pubClient publishes, subClient subscribes.
  //      All server instances share the same Redis channel."
  if (process.env.NODE_ENV !== "test") {
    io.adapter(createAdapter(pubClient, subClient));
  }

  // ─── JWT Authentication Middleware ────────────────────────────────────────
  // Runs before the "connection" event — rejects unauthenticated sockets early.
  // INTERVIEW: "How do you authenticate WebSocket connections?"
  //   → "Parse the JWT from the HTTP-only cookie in the handshake headers.
  //      Same token as REST — unified auth, no separate WS token."
  io.use((socket, next) => {
    try {
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const token = cookies["jwt"];

      if (!token) {
        return next(new Error("Authentication error: No token provided."));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      socket.userId = decoded.id; // attach userId to socket for use in handlers
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid or expired token."));
    }
  });

  // ─── Connection Handler ────────────────────────────────────────────────────
  io.on("connection", async (socket) => {
    const userId = socket.userId;
    logger.info("Socket connected", { userId, socketId: socket.id });

    // Each user joins a personal room named after their userId.
    // WHY: When we want to send a message to a specific user, we emit to
    //      their room — it reaches ALL their sockets (multiple tabs/devices).
    socket.join(userId);

    // Mark user as online in Redis Set
    await redis.sadd(ONLINE_USERS_KEY, userId);

    // Presence is friend-scoped: users only receive their own status plus
    // online friends, avoiding global fanout and leaking unrelated user state.
    await notifyPresenceScope(userId);

    // ── sendMessage ──────────────────────────────────────────────────────────
    // Client emits: { receiverId, text }
    // Server: saves to DB → emits to receiver's room → echoes back to sender
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
        const { receiverId, text, attachments, clientMessageId } = payload;

        const rateLimit = await consumeRateLimit({
          keyPrefix: "rate:socket:send-message",
          identifier: `${userId}:${socket.id}`,
          windowSeconds: runtimeConfig.rateLimit.messageWindowSeconds,
          maxRequests: runtimeConfig.rateLimit.messageMaxRequests,
        });

        if (!rateLimit.allowed) {
          socket.emit("error", {
            message: "Too many messages. Please slow down.",
            code: "MESSAGE_RATE_LIMITED",
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          });
          ack({
            ok: false,
            code: "MESSAGE_RATE_LIMITED",
            message: "Too many messages. Please slow down.",
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          });
          return;
        }

        const trimmedText = text?.trim();
        const normalizedAttachments = normalizeAttachments(attachments);

        if (attachments != null && normalizedAttachments == null) {
          ack({
            ok: false,
            code: "INVALID_ATTACHMENTS",
            message: "attachments payload is invalid.",
          });
          return;
        }

        if (
          !receiverId ||
          (!trimmedText && normalizedAttachments.length === 0)
        ) {
          ack({
            ok: false,
            code: "INVALID_MESSAGE_PAYLOAD",
            message:
              "receiverId and at least one of text/attachments are required.",
          });
          return;
        }

        const blockState = await getBlockState(userId, receiverId);
        if (blockState.isBlockedEitherWay) {
          socket.emit("error", {
            message:
              "Cannot send message because one user has blocked the other.",
            code: "MESSAGE_BLOCKED",
          });
          ack({
            ok: false,
            code: "MESSAGE_BLOCKED",
            message:
              "Cannot send message because one user has blocked the other.",
            isBlockedByMe: blockState.isBlockedByViewer,
            hasBlockedMe: blockState.hasBlockedViewer,
          });
          return;
        }

        const normalizedClientMessageId =
          normalizeClientMessageId(clientMessageId);
        if (clientMessageId && !normalizedClientMessageId) {
          ack({
            ok: false,
            code: "INVALID_CLIENT_MESSAGE_ID",
            message: "clientMessageId is invalid.",
          });
          return;
        }

        let message = null;
        let reusedExistingMessage = false;

        if (normalizedClientMessageId) {
          message = await Message.findOne({
            sender: userId,
            clientMessageId: normalizedClientMessageId,
          });
        }

        if (!message) {
          try {
            // Persist message to MongoDB
            message = await Message.create({
              sender: userId,
              receiver: receiverId,
              text: trimmedText || "",
              attachments: normalizedAttachments,
              clientMessageId: normalizedClientMessageId || undefined,
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

            message = await Message.findOne({
              sender: userId,
              clientMessageId: normalizedClientMessageId,
            });

            if (!message) {
              throw dbError;
            }
          }
        } else {
          reusedExistingMessage = true;
          incrementSocketRetry({
            event: "sendMessage",
            reason: "duplicate_client_message_id",
          });
        }

        if (!reusedExistingMessage) {
          await invalidateConversationCaches([userId, receiverId]);
          publishEvent({
            topic: eventTopics.messageSent,
            key: message._id.toString(),
            payload: {
              messageId: message._id.toString(),
              senderId: userId,
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
                userId,
                text: message.text,
                receiverId,
              },
            });
          }
        }

        // Send to receiver (may be on any server instance — Redis adapter handles routing)
        io.to(receiverId).emit("newMessage", message);

        // Echo back to sender (confirms delivery, syncs other tabs)
        io.to(userId).emit("newMessage", message);

        ack({
          ok: true,
          code: reusedExistingMessage ? "DUPLICATE_REPLAY" : "SENT",
          message,
          messageId: message._id,
          clientMessageId: message.clientMessageId || null,
          wasDuplicate: reusedExistingMessage,
        });

        logger.info("Socket message saved", {
          senderId: userId,
          receiverId,
          messageId: message._id,
          clientMessageId: message.clientMessageId,
          wasDuplicate: reusedExistingMessage,
        });
      } catch (err) {
        logger.error("sendMessage error", {
          error: err,
          userId,
          socketId: socket.id,
        });
        ack({
          ok: false,
          code: "SEND_MESSAGE_FAILED",
          message: "Failed to send message.",
        });
        socket.emit("error", { message: "Failed to send message." });
      }
    });

    // ── typing ───────────────────────────────────────────────────────────────
    // Client emits: { receiverId }
    // Server: forwards typing indicator to receiver
    socket.on("typing", ({ receiverId }) => {
      if (!receiverId) return;

      getBlockState(userId, receiverId)
        .then((blockState) => {
          if (blockState.isBlockedEitherWay) {
            return;
          }

          return consumeRateLimit({
            keyPrefix: "rate:socket:typing",
            identifier: `${userId}:${socket.id}`,
            windowSeconds: runtimeConfig.rateLimit.typingWindowSeconds,
            maxRequests: runtimeConfig.rateLimit.typingMaxRequests,
          }).then((rateLimit) => {
            if (!rateLimit.allowed) {
              return;
            }

            // Emit to receiver's room EXCEPT the sender (they know they're typing)
            socket.to(receiverId).emit("typing", { senderId: userId });
          });
        })
        .catch((error) => {
          logger.error("typing rate limit error", {
            error,
            userId,
            socketId: socket.id,
          });
        });
    });

    // ── stopTyping ───────────────────────────────────────────────────────────
    socket.on("stopTyping", ({ receiverId }) => {
      if (!receiverId) return;
      getBlockState(userId, receiverId)
        .then((blockState) => {
          if (blockState.isBlockedEitherWay) {
            return;
          }

          socket.to(receiverId).emit("stopTyping", { senderId: userId });
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

    // ── markAsRead ───────────────────────────────────────────────────────────
    // Client emits: { senderId } — "I've read all messages from this user"
    socket.on("markAsRead", async ({ senderId }) => {
      try {
        const readAt = new Date();
        const result = await Message.updateMany(
          { sender: senderId, receiver: userId, read: false },
          { $set: { read: true, readAt } },
        );
        await invalidateConversationCaches([userId, senderId]);
        if (result.modifiedCount > 0) {
          publishEvent({
            topic: eventTopics.messageRead,
            key: `${senderId}:${userId}`,
            payload: {
              senderId,
              readerId: userId,
              readAt: readAt.toISOString(),
              messageCount: result.modifiedCount,
            },
          });
        }
        // Notify the sender their messages were read
        io.to(senderId).emit("messagesRead", {
          readBy: userId,
          readAt,
        });
      } catch (err) {
        logger.error("markAsRead error", {
          error: err,
          userId,
          senderId,
          socketId: socket.id,
        });
      }
    });

    socket.on("call:invite", ({ receiverId, callId }) => {
      if(!receiverId || !callId) return;

      socket.to(receiverId).emit("call:incoming", {
        callerId: userId,
        callId,
      });
    });

    socket.on("call:accept", ({ callerId, callId }) => {
      if(!callerId || !callId) return;

      socket.to(callerId).emit("call:accepted", {
        receiverId: userId,
        callId,
      });
    });

    socket.on("call:reject", ({ callerId, callId }) => {
      if(!callerId || !callId) return;

      socket.to(callerId).emit("call:rejected", {
        receiverId: userId,
        callId,
      });
    });

    socket.on("call:end", ({ receiverId, callId }) => {
      if(!receiverId || !callId) return;

      socket.to(receiverId).emit("call:ended", {
        senderId: userId,
        callId,
      });
    });

    socket.on("webrtc:offer", ({ receiverId, callId, offer }) => {
      if(!receiverId || !callId || !offer) return;

      socket.to(receiverId).emit("webrtc:offer", {
        senderId: userId,
        callId,
        offer,
      })
    })

    socket.on("webrtc:answer", ({ receiverId, callId, answer }) => {
      if(!receiverId || !callId || !answer) return;

      socket.to(receiverId).emit("webrtc:answer", {
        senderId: userId,
        callId,
        answer,
      });
    });

    socket.on("webrtc:ice-candidate", ({ receiverId, callId, candidate }) => {
      if(!receiverId || !callId || !candidate) return;

      socket.to(receiverId).emit("webrtc:ice-candidate", {
        senderId: userId,
        callId,
        candidate,
      });
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", async (reason) => {
      logger.info("Socket disconnected", {
        userId,
        socketId: socket.id,
        reason,
      });

      // Only remove from online set if user has NO other active sockets
      // WHY: User might have two browser tabs open — closing one tab
      //      shouldn't mark them offline if the other tab is still connected.
      const userSockets = await io.in(userId).fetchSockets();
      if (userSockets.length === 0) {
        await redis.srem(ONLINE_USERS_KEY, userId);
        await notifyPresenceScope(userId);
        logger.info("User went offline", { userId });
      }
    });
  });

  logger.info("Socket.IO initialized with Redis adapter");
  return io;
};
