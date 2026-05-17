import express from "express";
import {
  protectRoute,
  requireVerifiedUser,
} from "../../core/middleware/auth.middleware.js";
import {
  createPartnerCorrectionController,
  correctMessageController,
  getLearningDashboardController,
  getPartnerCorrectionsController,
  savePhraseController,
  translateMessageController,
} from "./learning.controller.js";
import {
  correctMessageValidation,
  partnerCorrectionValidation,
  partnerCorrectionsQueryValidation,
  savePhraseValidation,
  translateMessageValidation,
} from "./learning.validators.js";

const router = express.Router();

router.use(protectRoute, requireVerifiedUser);

router.get("/dashboard", getLearningDashboardController);
router.get(
  "/partner-corrections",
  partnerCorrectionsQueryValidation,
  getPartnerCorrectionsController,
);
router.post(
  "/partner-corrections",
  partnerCorrectionValidation,
  createPartnerCorrectionController,
);
router.post("/correct", correctMessageValidation, correctMessageController);
router.post(
  "/translate",
  translateMessageValidation,
  translateMessageController,
);
router.post("/phrases", savePhraseValidation, savePhraseController);

export default router;
