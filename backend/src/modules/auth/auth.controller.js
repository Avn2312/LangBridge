import { logger } from "../../core/observability/logger.js";
import { sendError } from "../../core/http/api-response.js";
import { clearAuthCookie, setAuthCookie } from "./auth.cookies.js";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  onboardUser,
  resendUserVerificationEmail,
  signupUser,
  verifyUserEmail,
} from "./auth.service.js";

const sendServiceError = (res, error, fallbackMessage = "Internal Server Error.") =>
  sendError(res, error.statusCode || 500, error.message || fallbackMessage, {
    code: error.code || "INTERNAL_SERVER_ERROR",
    ...error.details,
  });

export async function signup(req, res) {
  try {
    const { token, payload } = await signupUser(req.body);
    setAuthCookie(res, token);
    return res.status(201).json(payload);
  } catch (error) {
    logger.error("Error in signup controller", error);
    return sendServiceError(res, error);
  }
}

export async function resendVerificationEmail(req, res) {
  try {
    const payload = await resendUserVerificationEmail(req.user._id);
    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Error in resendVerificationEmail controller", error);
    return sendServiceError(res, error, "Could not resend verification email.");
  }
}

export async function verifyEmail(req, res) {
  try {
    const redirectUrl = await verifyUserEmail(req.query.token);
    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error("Error verifying email", error);

    if (error.name === "TokenExpiredError") {
      return sendError(
        res,
        401,
        "Verification link has expired. Please request a new one.",
        {
          code: "VERIFICATION_TOKEN_EXPIRED",
        },
      );
    }

    if (error.name === "JsonWebTokenError") {
      return sendError(res, 401, "Invalid verification token.", {
        code: "VERIFICATION_TOKEN_INVALID",
      });
    }

    return sendServiceError(res, error);
  }
}

export async function login(req, res) {
  try {
    const { token, payload } = await loginUser({
      email: req.body.email,
      password: req.body.password,
      bruteForceKey: req.bruteForceKey,
    });

    setAuthCookie(res, token);
    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Error in login controller", error);
    return sendServiceError(res, error);
  }
}

export async function logout(req, res) {
  await logoutUser(req.cookies.jwt);
  clearAuthCookie(res);
  return res
    .status(200)
    .json({ success: true, message: "Logout successfully." });
}

export async function onboard(req, res) {
  try {
    const payload = await onboardUser({
      userId: req.user._id,
      body: req.body,
    });

    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Onboarding error", error);
    return sendServiceError(res, error);
  }
}

export async function getMe(req, res) {
  try {
    const payload = await getCurrentUser(req.user._id);
    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Error fetching user", error);
    return sendServiceError(res, error);
  }
}
