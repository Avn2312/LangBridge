import { sendError } from "../../core/http/api-response.js";

export const validateChatAttachment = (req, res, next) => {
  if (!req.file) {
    return sendError(res, 400, "No file provided.", {
      code: "NO_ATTACHMENT_FILE",
    });
  }

  if (String(req.file.originalname || "").length > 255) {
    return sendError(res, 400, "Attachment filename is too long.", {
      code: "ATTACHMENT_FILENAME_TOO_LONG",
    });
  }

  next();
};
