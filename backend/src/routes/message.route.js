import express from "express";
import {
  protectRoute,
  requireVerifiedUser,
} from "../middlewares/auth.middleware.js";
import {
  getMessages,
  getConversations,
} from "../controllers/message.controller.js";
import { userIdParamValidation } from "../validation/user.validator.js";
import { createRateLimitMiddleware } from "../lib/rateLimit.js";
import { runtimeConfig } from "../lib/runtimeConfig.js";

const router = express.Router();

const messageReadLimiter = createRateLimitMiddleware({
  keyPrefix: "rate:messages:http",
  windowSeconds: runtimeConfig.rateLimit.messageWindowSeconds,
  maxRequests: Math.max(runtimeConfig.rateLimit.messageMaxRequests * 2, 60),
  message: "Too many message requests. Please try again later.",
});

// All message routes require authentication
router.use(protectRoute);

// ── GET /api/messages/conversations ──────────────────────────────────────────
// List all conversations (with last message + unread count)
// Must come BEFORE /:userId to avoid "conversations" being parsed as a userId
router.get(
  "/conversations",
  requireVerifiedUser,
  messageReadLimiter,
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
  getMessages,
);

export default router;
