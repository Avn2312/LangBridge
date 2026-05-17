import express from "express";
import {
  protectRoute,
  requireVerifiedUser,
} from "../../core/middleware/auth.middleware.js";
import {
  getModerationQueueController,
  updateReportStatusController,
} from "./moderation.controller.js";
import {
  moderationQueueQueryValidation,
  updateReportStatusValidation,
} from "./moderation.validators.js";

const router = express.Router();

router.use(protectRoute, requireVerifiedUser);

router.get(
  "/reports",
  moderationQueueQueryValidation,
  getModerationQueueController,
);
router.patch(
  "/reports/:id",
  updateReportStatusValidation,
  updateReportStatusController,
);

export default router;
