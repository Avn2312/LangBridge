import { param, validationResult } from "express-validator";
import { sendError } from "../lib/apiResponse.js";

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return sendError(res, 400, "Validation failed.", {
    code: "VALIDATION_ERROR",
    errors: errors.array(),
  });
};

export const userIdParamValidation = [
  // The message route uses /:userId — validate whichever param name is present
  param("userId")
    .optional()
    .isMongoId()
    .withMessage("userId should be a valid MongoDB ObjectId"),
  param("id")
    .optional()
    .isMongoId()
    .withMessage("id should be a valid MongoDB ObjectId"),
  validate,
];
