import { body, query, validationResult } from "express-validator";
import { sendError } from "../../core/http/api-response.js";

const fieldError = (message, code) => ({ message, code });

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const firstError = errors.array()[0];
  const message = firstError.msg?.message || "Validation failed.";
  const code = firstError.msg?.code || "VALIDATION_ERROR";

  return sendError(res, 400, message, { code });
};

const optionalBodyObjectId = (fieldName, code) =>
  body(fieldName)
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage(fieldError(`${fieldName} is invalid.`, code));

const optionalQueryObjectId = (fieldName, code) =>
  query(fieldName)
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage(fieldError(`${fieldName} is invalid.`, code));

export const correctMessageValidation = [
  optionalBodyObjectId("messageId", "INVALID_MESSAGE_ID"),
  optionalBodyObjectId("partnerId", "INVALID_PARTNER_ID"),
  validate,
];

export const partnerCorrectionValidation = [
  body("messageId")
    .isMongoId()
    .withMessage(fieldError("messageId is invalid.", "INVALID_MESSAGE_ID")),
  validate,
];

export const partnerCorrectionsQueryValidation = [
  optionalQueryObjectId("partnerId", "INVALID_PARTNER_ID"),
  validate,
];

export const translateMessageValidation = [
  optionalBodyObjectId("messageId", "INVALID_MESSAGE_ID"),
  optionalBodyObjectId("partnerId", "INVALID_PARTNER_ID"),
  validate,
];

export const savePhraseValidation = [
  optionalBodyObjectId("messageId", "INVALID_MESSAGE_ID"),
  optionalBodyObjectId("partnerId", "INVALID_PARTNER_ID"),
  validate,
];
