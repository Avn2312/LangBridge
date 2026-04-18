import { param, validationResult } from "express-validator";

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    errors: errors.array(),
  });
};

export const userIdParamValidation = [
  param("id").isMongoId().withMessage("id should be a valid MongoDB ObjectId"),
  validate,
];
