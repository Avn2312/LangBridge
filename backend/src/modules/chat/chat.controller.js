import { logger } from "../../core/observability/logger.js";
import { sendError } from "../../core/http/api-response.js";
import {
  listConversations,
  listMessagesWithUser,
} from "./chat.service.js";

export async function getMessages(req, res) {
  try {
    const result = await listMessagesWithUser({
      viewerId: req.user._id,
      otherUserId: req.params.userId,
      query: req.query,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in getMessages", error);
    return sendError(
      res,
      error.statusCode || 500,
      error.message || "Internal Server Error.",
      {
        code: error.code || "INTERNAL_SERVER_ERROR",
        ...error.details,
      },
    );
  }
}

export async function getConversations(req, res) {
  try {
    const result = await listConversations({
      userId: req.user._id,
      query: req.query,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in getConversations", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
