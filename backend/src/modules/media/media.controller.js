import { logger } from "../../core/observability/logger.js";
import { sendError } from "../../core/http/api-response.js";
import { uploadChatAttachment } from "./media.service.js";

export async function uploadMessageAttachment(req, res) {
  try {
    const attachment = await uploadChatAttachment(req.file);

    return res.status(201).json({
      success: true,
      attachment,
    });
  } catch (error) {
    logger.error("Error uploading message attachment", error);
    return sendError(
      res,
      error.statusCode || 500,
      error.statusCode ? error.message : "Failed to upload attachment.",
      {
        code: error.code || "ATTACHMENT_UPLOAD_FAILED",
      },
    );
  }
}
