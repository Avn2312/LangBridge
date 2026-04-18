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
  registerValidation,
  loginValidation,
  onboardingValidation,
} from "../validation/auth.validator.js";

const router = express.Router();

// ──── LOCAL AUTH ROUTES ────
router.post("/signup", registerValidation, signup);
router.get("/verify-email", verifyEmail);
router.post("/login", loginValidation, login);

// ──── PROTECTED ROUTES ────
router.post("/logout", protectRoute, logout);
router.post("/onboarding", protectRoute, onboardingValidation, onboard);
router.post("/resend-verification", protectRoute, resendVerificationEmail);

// Check if user is logged in (called on every page load by frontend)
router.get("/me", protectRoute, getMe);

// ──── GOOGLE OAUTH ROUTES ────

// Step 1: Start OAuth flow — redirects user to Google's consent screen
router.get(
  "/google",
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
  passport.authenticate("google", {
    failureRedirect: "http://localhost:5173/login",
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
    const redirectUrl = req.user.isOnboarded
      ? "http://localhost:5173/"
      : "http://localhost:5173/onboarding";

    res.redirect(redirectUrl);
  },
);

export default router;
