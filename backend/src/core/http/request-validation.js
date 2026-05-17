import { validationResult } from "express-validator";
import { sendError } from "./api-response.js";

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const firstError = errors.array()[0];
  const message = firstError.msg?.message || "Validation failed.";
  const code = firstError.msg?.code || "VALIDATION_ERROR";

  return sendError(res, 400, message, {
    code,
    errors: errors.array(),
  });
};

export const fieldError = (message, code) => ({ message, code });
