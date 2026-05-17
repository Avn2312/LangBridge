import { sendError } from "../../core/http/api-response.js";
import { logger } from "../../core/observability/logger.js";
import {
  correctMessage,
  createPartnerCorrection,
  getLearningDashboard,
  listPartnerCorrections,
  savePhrase,
  translateMessage,
} from "./learning.service.js";

const sendControllerError = (res, error) =>
  sendError(
    res,
    error.statusCode || 500,
    error.message || "Internal Server Error.",
    {
      code: error.code || "INTERNAL_SERVER_ERROR",
    },
  );

export async function correctMessageController(req, res) {
  try {
    const result = await correctMessage({
      user: req.user,
      body: req.body,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in correctMessageController", error);
    return sendControllerError(res, error);
  }
}

export async function createPartnerCorrectionController(req, res) {
  try {
    const result = await createPartnerCorrection({
      user: req.user,
      body: req.body,
    });

    return res.status(201).json(result);
  } catch (error) {
    logger.error("Error in createPartnerCorrectionController", error);
    return sendControllerError(res, error);
  }
}

export async function getPartnerCorrectionsController(req, res) {
  try {
    const result = await listPartnerCorrections({
      userId: req.user._id,
      query: req.query,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in getPartnerCorrectionsController", error);
    return sendControllerError(res, error);
  }
}

export async function translateMessageController(req, res) {
  try {
    const result = await translateMessage({
      user: req.user,
      body: req.body,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in translateMessageController", error);
    return sendControllerError(res, error);
  }
}

export async function savePhraseController(req, res) {
  try {
    const result = await savePhrase({
      user: req.user,
      body: req.body,
    });

    return res.status(201).json(result);
  } catch (error) {
    logger.error("Error in savePhraseController", error);
    return sendControllerError(res, error);
  }
}

export async function getLearningDashboardController(req, res) {
  try {
    const result = await getLearningDashboard({ userId: req.user._id });
    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in getLearningDashboardController", error);
    return sendControllerError(res, error);
  }
}
