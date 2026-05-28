import { body, param, validationResult } from "express-validator";
import { sendError } from "../../core/http/api-response.js";

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

export const updateProfileValidation = [
  body("fullName")
    .isString()
    .withMessage("fullName should be string")
    .trim()
    .notEmpty()
    .withMessage("fullName is required"),
  body("bio")
    .isString()
    .withMessage("bio should be string")
    .trim()
    .notEmpty()
    .withMessage("bio is required"),
  body("nativeLanguage")
    .isString()
    .withMessage("nativeLanguage should be string")
    .trim()
    .notEmpty()
    .withMessage("nativeLanguage is required"),
  body("learningLanguage")
    .isString()
    .withMessage("learningLanguage should be string")
    .trim()
    .notEmpty()
    .withMessage("learningLanguage is required"),
  body("location")
    .isString()
    .withMessage("location should be string")
    .trim()
    .notEmpty()
    .withMessage("location is required"),
  body("timezone").optional().isString().trim(),
  body("proficiencyLevel")
    .optional()
    .isIn(["beginner", "intermediate", "advanced", ""])
    .withMessage("proficiencyLevel is invalid"),
  body("interests").optional().isArray({ max: 8 }),
  body("interests.*").optional().isString().trim().isLength({ max: 40 }),
  body("profilePic")
    .optional({ values: "falsy" })
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("profilePic should be a valid image URL"),
  validate,
];
