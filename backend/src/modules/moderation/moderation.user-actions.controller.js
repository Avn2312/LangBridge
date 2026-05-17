import { logger } from "../../core/observability/logger.js";
import { sendError } from "../../core/http/api-response.js";
import {
  blockUser,
  reportUser,
  unblockUser,
} from "./moderation.service.js";

const sendControllerError = (res, error) =>
  sendError(
    res,
    error.statusCode || 500,
    error.message || "Internal Server Error.",
    {
      code: error.code || "INTERNAL_SERVER_ERROR",
    },
  );

export async function blockUserController(req, res) {
  try {
    const result = await blockUser({
      userId: req.user.id,
      targetUserId: req.params.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in blockUser controller", error);
    return sendControllerError(res, error);
  }
}

export async function unblockUserController(req, res) {
  try {
    const result = await unblockUser({
      userId: req.user.id,
      targetUserId: req.params.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in unblockUser controller", error);
    return sendControllerError(res, error);
  }
}

export async function reportUserController(req, res) {
  try {
    const result = await reportUser({
      reporterId: req.user.id,
      reportedId: req.params.id,
      body: req.body,
    });

    return res.status(201).json(result);
  } catch (error) {
    logger.error("Error in reportUser controller", error);
    return sendControllerError(res, error);
  }
}
