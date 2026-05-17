import { query } from "express-validator";
import { fieldError, validateRequest } from "../../core/http/request-validation.js";

const languageFilter = (fieldName) =>
  query(fieldName)
    .optional()
    .isString()
    .trim()
    .isLength({ max: 80 })
    .withMessage(
      fieldError(`${fieldName} must be 80 characters or fewer.`, "INVALID_FILTER"),
    );

export const recommendationsQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage(fieldError("page must be a positive integer.", "INVALID_PAGE")),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage(
      fieldError("limit must be an integer between 1 and 50.", "INVALID_LIMIT"),
    ),
  languageFilter("targetLanguage"),
  languageFilter("nativeLanguage"),
  query("proficiency")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 40 })
    .withMessage(
      fieldError("proficiency filter is invalid.", "INVALID_PROFICIENCY"),
    ),
  query("onlineNow")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 20 })
    .withMessage(fieldError("onlineNow filter is invalid.", "INVALID_ONLINE_FILTER")),
  validateRequest,
];
