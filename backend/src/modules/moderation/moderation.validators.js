import { body, param, query } from "express-validator";
import { fieldError, validateRequest } from "../../core/http/request-validation.js";

const REPORT_STATUSES = ["open", "reviewing", "actioned", "closed"];
export const moderationQueueQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage(fieldError("page must be a positive integer.", "INVALID_PAGE")),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage(
      fieldError("limit must be an integer between 1 and 100.", "INVALID_LIMIT"),
    ),
  query("status")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 40 })
    .withMessage(fieldError("Invalid moderation status.", "INVALID_REPORT_STATUS")),
  validateRequest,
];

export const updateReportStatusValidation = [
  param("id")
    .isMongoId()
    .withMessage(fieldError("id should be a valid MongoDB ObjectId", "INVALID_ID")),
  body("status")
    .isIn(REPORT_STATUSES)
    .withMessage(fieldError("Invalid moderation status.", "INVALID_REPORT_STATUS")),
  body("moderatorNote")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage(
      fieldError("moderatorNote must be 1000 characters or fewer.", "INVALID_NOTE"),
    ),
  validateRequest,
];

export const reportUserValidation = [
  body("reason")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage(
      fieldError("reason must be 2000 characters or fewer.", "INVALID_REASON"),
    ),
  body("category")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 80 })
    .withMessage(fieldError("report category is invalid.", "INVALID_REPORT_CATEGORY")),
  body("messageId")
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage(fieldError("messageId is invalid.", "INVALID_MESSAGE_ID")),
  validateRequest,
];
