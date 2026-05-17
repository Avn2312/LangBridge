import express from "express";
import multer from "multer";
import {
  protectRoute,
  requireVerifiedUser,
} from "../../core/middleware/auth.middleware.js";
import {
  getMessages,
  getConversations,
} from "./chat.controller.js";
import { uploadMessageAttachment } from "../media/media.controller.js";
import { validateChatAttachment } from "../media/media.validators.js";
import { userIdParamValidation } from "../users/user.validators.js";
import {
  conversationsQueryValidation,
  messagesQueryValidation,
} from "./chat.validators.js";
import { createRateLimitMiddleware } from "../../infrastructure/redis/rate-limit.store.js";
import { runtimeConfig } from "../../config/env.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const messageReadLimiter = createRateLimitMiddleware({
  keyPrefix: "rate:messages:http",
  windowSeconds: runtimeConfig.rateLimit.messageWindowSeconds,
  maxRequests: Math.max(runtimeConfig.rateLimit.messageMaxRequests * 2, 60),
  message: "Too many message requests. Please try again later.",
});

// All message routes require authentication
router.use(protectRoute);

// ── POST /api/messages/attachments ───────────────────────────────────────────
// Upload chat files/voice notes before sending the Socket.IO message.
router.post(
  "/attachments",
  requireVerifiedUser,
  upload.single("file"),
  validateChatAttachment,
  uploadMessageAttachment,
);

// ── GET /api/messages/conversations ──────────────────────────────────────────
// List all conversations (with last message + unread count)
// Must come BEFORE /:userId to avoid "conversations" being parsed as a userId
router.get(
  "/conversations",
  requireVerifiedUser,
  messageReadLimiter,
  conversationsQueryValidation,
  getConversations,
);

// ── GET /api/messages/:userId ─────────────────────────────────────────────────
// Paginated message history between me and :userId
// Query: ?page=1&limit=50
router.get(
  "/:userId",
  requireVerifiedUser,
  messageReadLimiter,
  userIdParamValidation,
  messagesQueryValidation,
  getMessages,
);

export default router;
