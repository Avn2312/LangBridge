import express from "express";
import {
  protectRoute,
  requireVerifiedUser,
} from "../middlewares/auth.middleware.js";
import {
  createPartnerCorrectionController,
  correctMessageController,
  getLearningDashboardController,
  getPartnerCorrectionsController,
  savePhraseController,
  translateMessageController,
} from "../controllers/learning.controller.js";

const router = express.Router();

router.use(protectRoute, requireVerifiedUser);

router.get("/dashboard", getLearningDashboardController);
router.get("/partner-corrections", getPartnerCorrectionsController);
router.post("/partner-corrections", createPartnerCorrectionController);
router.post("/correct", correctMessageController);
router.post("/translate", translateMessageController);
router.post("/phrases", savePhraseController);

export default router;
