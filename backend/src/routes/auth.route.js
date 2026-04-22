import express from "express";
import {
  signup,
  login,
  verifyEmail,
  resendVerificationEmail,
  logout,
  onboard,
  getMe,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";
import { generateToken, setAuthCookie } from "../lib/auth.utils.js";
import passport from "passport";
import {
  createRateLimitMiddleware,
  createBruteForceGuard,
} from "../lib/rateLimit.js";
import { runtimeConfig, getFrontendUrl } from "../lib/runtimeConfig.js";
import {
  registerValidation,
  loginValidation,
  onboardingValidation,
} from "../validation/auth.validator.js";

const router = express.Router();

const signupLimiter = createRateLimitMiddleware({
  keyPrefix: "rate:auth:signup",
  windowSeconds: runtimeConfig.rateLimit.authWindowSeconds,
  maxRequests: runtimeConfig.rateLimit.authMaxRequests,
  message: "Too many signup attempts. Please try again later.",
});

const loginLimiter = createRateLimitMiddleware({
  keyPrefix: "rate:auth:login",
  windowSeconds: runtimeConfig.rateLimit.authWindowSeconds,
  maxRequests: runtimeConfig.rateLimit.authMaxRequests,
  message: "Too many login attempts. Please try again later.",
});

const loginBruteForceGuard = createBruteForceGuard({
  keyPrefix: "rate:auth:login",
  message: "Too many failed login attempts. Please try again later.",
});

const resendVerificationLimiter = createRateLimitMiddleware({
  keyPrefix: "rate:auth:resend-verification",
  windowSeconds: runtimeConfig.rateLimit.resendWindowSeconds,
  maxRequests: runtimeConfig.rateLimit.resendMaxRequests,
  message: "Too many verification email requests. Please try again later.",
});

const authReadLimiter = createRateLimitMiddleware({
  keyPrefix: "rate:auth:read",
  windowSeconds: runtimeConfig.rateLimit.authWindowSeconds,
  maxRequests: Math.max(runtimeConfig.rateLimit.authMaxRequests * 3, 30),
  message: "Too many authentication requests. Please try again later.",
});

const authMutationLimiter = createRateLimitMiddleware({
  keyPrefix: "rate:auth:mutation",
  windowSeconds: runtimeConfig.rateLimit.authWindowSeconds,
  maxRequests: Math.max(runtimeConfig.rateLimit.authMaxRequests * 2, 20),
  message: "Too many authentication requests. Please try again later.",
});

const googleAuthLimiter = createRateLimitMiddleware({
  keyPrefix: "rate:auth:google",
  windowSeconds: runtimeConfig.rateLimit.authWindowSeconds,
  maxRequests: Math.max(runtimeConfig.rateLimit.authMaxRequests * 2, 20),
  message: "Too many Google auth attempts. Please try again later.",
});

// ──── LOCAL AUTH ROUTES ────
router.post("/signup", registerValidation, signupLimiter, signup);
router.get("/verify-email", authReadLimiter, verifyEmail);
router.post(
  "/login",
  loginValidation,
  loginLimiter,
  loginBruteForceGuard,
  login,
);

// ──── PROTECTED ROUTES ────
router.post("/logout", protectRoute, authMutationLimiter, logout);
router.post(
  "/onboarding",
  protectRoute,
  authMutationLimiter,
  onboardingValidation,
  onboard,
);
router.post(
  "/resend-verification",
  protectRoute,
  resendVerificationLimiter,
  resendVerificationEmail,
);

// Check if user is logged in (called on every page load by frontend)
router.get("/me", protectRoute, authReadLimiter, getMe);

// ──── GOOGLE OAUTH ROUTES ────

// Step 1: Start OAuth flow — redirects user to Google's consent screen
router.get(
  "/google",
  googleAuthLimiter,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    // scope tells Google what data we want:
    // "profile" = name, picture
    // "email" = email address
  }),
);

// Step 2: Google redirects back here after user approves
router.get(
  "/google/callback",
  googleAuthLimiter,
  passport.authenticate("google", {
    failureRedirect: `${getFrontendUrl()}/login?error=oauth_failed`,
    session: false,
    // session: false — we DON'T use Passport sessions for auth
    // WHY: We use JWT cookies instead. Passport sessions would mean
    //      a separate auth system from our email/password flow.
    //      By using JWT everywhere, the auth is UNIFIED.
  }),
  (req, res) => {
    // If we reach here, Passport has authenticated the user
    // and set req.user = the MongoDB user object

    // Generate JWT — SAME function as email/password login
    const token = generateToken(req.user._id);

    // Set cookie — SAME function as email/password login
    setAuthCookie(res, token);

    // Redirect to frontend
    // The frontend will call /api/auth/me, which reads the JWT cookie
    // and returns the user — just like after email/password login
    const frontendUrl = getFrontendUrl();
    const redirectUrl = req.user.isOnboarded
      ? `${frontendUrl}/`
      : `${frontendUrl}/onboarding`;

    res.redirect(redirectUrl);
  },
);

export default router;
