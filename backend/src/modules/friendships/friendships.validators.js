import { query } from "express-validator";
import { fieldError, validateRequest } from "../../core/http/request-validation.js";

export const friendshipListQueryValidation = [
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
  validateRequest,
];
