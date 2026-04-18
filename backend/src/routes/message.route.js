import express from "express";
import { protectRoute, requireVerifiedUser } from "../middlewares/auth.middleware.js";
import { getMessages, getConversations } from "../controllers/message.controller.js";
import { param } from "express-validator";
import { userIdParamValidation } from "../validation/user.validator.js";

const router = express.Router();

// All message routes require authentication
router.use(protectRoute);

// ── GET /api/messages/conversations ──────────────────────────────────────────
// List all conversations (with last message + unread count)
// Must come BEFORE /:userId to avoid "conversations" being parsed as a userId
router.get("/conversations", requireVerifiedUser, getConversations);

// ── GET /api/messages/:userId ─────────────────────────────────────────────────
// Paginated message history between me and :userId
// Query: ?page=1&limit=50
router.get("/:userId", requireVerifiedUser, userIdParamValidation, getMessages);

export default router;
