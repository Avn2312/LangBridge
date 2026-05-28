import { logger } from "../../core/observability/logger.js";
import { sendError } from "../../core/http/api-response.js";
import { getUserProfile, updateMyProfile } from "./users.service.js";

const sendControllerError = (res, error) =>
  sendError(
    res,
    error.statusCode || 500,
    error.message || "Internal Server Error.",
    {
      code: error.code || "INTERNAL_SERVER_ERROR",
    },
  );

export async function getUserByIdController(req, res) {
  try {
    const profile = await getUserProfile({
      viewerId: req.user.id,
      targetUserId: req.params.id,
    });

    return res.status(200).json(profile);
  } catch (error) {
    logger.error("Error in getUserById controller", error);
    return sendControllerError(res, error);
  }
}

export async function updateMyProfileController(req, res) {
  try {
    const payload = await updateMyProfile({
      userId: req.user._id,
      body: req.body,
    });

    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Error in updateMyProfile controller", error);
    return sendControllerError(res, error);
  }
}
