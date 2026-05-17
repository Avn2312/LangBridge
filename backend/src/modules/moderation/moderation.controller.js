import { sendError } from "../../core/http/api-response.js";
import { logger } from "../../core/observability/logger.js";
import {
  changeReportStatus,
  getModerationQueue,
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

export async function getModerationQueueController(req, res) {
  try {
    const result = await getModerationQueue({ query: req.query });
    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in getModerationQueueController", error);
    return sendControllerError(res, error);
  }
}

export async function updateReportStatusController(req, res) {
  try {
    const result = await changeReportStatus({
      reportId: req.params.id,
      body: req.body,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in updateReportStatusController", error);
    return sendControllerError(res, error);
  }
}
