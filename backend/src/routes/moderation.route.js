import express from "express";
import {
  protectRoute,
  requireVerifiedUser,
} from "../middlewares/auth.middleware.js";
import {
  getModerationQueueController,
  updateReportStatusController,
} from "../controllers/moderation.controller.js";

const router = express.Router();

router.use(protectRoute, requireVerifiedUser);

router.get("/reports", getModerationQueueController);
router.patch("/reports/:id", updateReportStatusController);

export default router;
