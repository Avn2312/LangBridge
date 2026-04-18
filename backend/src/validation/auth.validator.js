import { body, validationResult } from "express-validator";

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    errors: errors.array(),
  });
};

const passwordRegex = /^(?=.*[A-Z])(?=.*\d).+$/;

export const registerValidation = [
  body("fullName")
    .isString()
    .withMessage("fullName should be string")
    .trim()
    .notEmpty()
    .withMessage("fullName is required"),
  body("email")
    .isEmail()
    .withMessage("email should be valid email address")
    .normalizeEmail(),
  body("password")
    .isString()
    .withMessage("password should be string")
    .custom((value) => {
      if (value.length < 8) {
        throw new Error("password should be at least 8 characters long");
      }
      if (!passwordRegex.test(value)) {
        throw new Error(
          "password should contain at least one uppercase letter and one number",
        );
      }
      return true;
    })
    .withMessage(
      "password should be at least 8 characters long and contain at least one uppercase letter and one number",
    ),
  validate,
];

export const loginValidation = [
  body("email")
    .isEmail()
    .withMessage("email should be valid email address")
    .normalizeEmail(),
  body("password")
    .isString()
    .withMessage("password should be string")
    .notEmpty()
    .withMessage("password is required"),
  validate,
];

export const onboardingValidation = [
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
  validate,
];
