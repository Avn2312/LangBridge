import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import {
  generateToken,
  generateVerificationToken,
  setAuthCookie,
} from "../lib/auth.utils.js";
import { sendEmail } from "../services/mail.service.js";
import { sendError } from "../lib/apiResponse.js";
import { clearBruteForceTracking, recordFailure } from "../lib/rateLimit.js";
import {
  runtimeConfig,
  getBaseUrl,
  getFrontendUrl,
} from "../lib/runtimeConfig.js";

async function sendVerificationEmail({ userId, email, fullName }) {
  const verificationToken = generateVerificationToken(userId);
  const verifyUrl = `${getBaseUrl()}/api/auth/verify-email?token=${verificationToken}`;

  return sendEmail({
    to: email,
    subject: "Verify your LangBridge email!",
    html: `
      <p>Hi ${fullName},</p>
      <p>Welcome to LangBridge! We're excited to have you on board.</p>
      <p>Please verify your email address by clicking the link below. This link expires in <strong>24 hours</strong>.</p>
      <a href="${verifyUrl}">Verify My Email</a>
      <p>If you did not create this account, you can safely ignore this email.</p>
      <p>If you have any questions, reach out to us at support@langbridge.io.</p>
      <p>Happy learning!</p>
      <p>The LangBridge Team</p>
    `,
  });
}

export async function signup(req, res) {
  const { email, password, fullName } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(
        res,
        400,
        "Email already exists, please use a different one.",
        {
          code: "EMAIL_ALREADY_EXISTS",
        },
      );
    }

    // Random avatar generation
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    // Step 1: Create user in MongoDB
    const newUser = await User.create({
      email,
      fullName,
      password,
      profilePic: randomAvatar,
      provider: "local", // explicitly mark as local signup
    });

    // Step 2: Generate session JWT and set cookie (logs user in immediately)
    // USING SHARED UTILITY — same settings as login and OAuth callback
    const token = generateToken(newUser._id);
    setAuthCookie(res, token);

    // Non-fatal: if the email fails, the user is already created and logged in.
    // We log the error but still return 201 so the signup succeeds.
    try {
      const mailInfo = await sendVerificationEmail({
        userId: newUser._id,
        email,
        fullName,
      });

      logger.info("Verification email delivery status", {
        userId: newUser._id.toString(),
        email,
        messageId: mailInfo.messageId,
        accepted: mailInfo.accepted,
        rejected: mailInfo.rejected,
      });
    } catch (emailError) {
      // Log but don't fail — user is created and has a valid session cookie.
      logger.error("Verification email failed to send", emailError);
    }

    res.status(201).json({
      success: true,
      message: "Signup successful.",
      user: {
        id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        profilePic: newUser.profilePic,
        nativeLanguage: newUser.nativeLanguage,
        learningLanguage: newUser.learningLanguage,
      },
    });
  } catch (error) {
    logger.error("Error in signup controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function resendVerificationEmail(req, res) {
  try {
    const user = await User.findById(req.user._id).select(
      "email fullName verified",
    );

    if (!user) {
      return sendError(res, 404, "User not found.", { code: "USER_NOT_FOUND" });
    }

    if (user.verified) {
      return sendError(res, 400, "Your email is already verified.", {
        code: "EMAIL_ALREADY_VERIFIED",
      });
    }

    const mailInfo = await sendVerificationEmail({
      userId: user._id,
      email: user.email,
      fullName: user.fullName,
    });

    return res.status(200).json({
      success: true,
      message:
        "Verification email sent. Please check your inbox and spam folder.",
      messageId: mailInfo.messageId,
    });
  } catch (error) {
    logger.error("Error in resendVerificationEmail controller", error);
    return sendError(res, 500, "Could not resend verification email.", {
      code: "RESEND_VERIFICATION_FAILED",
    });
  }
}

export async function verifyEmail(req, res) {
  const { token } = req.query;

  if (!token) {
    return sendError(res, 400, "Verification token is missing.", {
      code: "VERIFICATION_TOKEN_MISSING",
    });
  }

  try {
    // Verify signature + expiry in one call. Throws on failure.
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // SECURITY: Ensure this is a verification token, not a stolen session token.
    // Session tokens have no 'purpose' claim; verification tokens have
    // purpose: "email-verification" baked in by generateVerificationToken().
    if (decoded.purpose !== "email-verification") {
      return sendError(res, 401, "Invalid token: wrong token type.", {
        code: "VERIFICATION_TOKEN_TYPE_INVALID",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return sendError(res, 404, "User not found.", { code: "USER_NOT_FOUND" });
    }

    // Guard: prevent processing a link that was already used.
    if (user.verified) {
      return sendError(res, 400, "Email is already verified.", {
        code: "EMAIL_ALREADY_VERIFIED",
      });
    }

    user.verified = true;
    await user.save();

    res.redirect(`${getFrontendUrl()}/login?verified=true`);

    // res.status(200).json({ success: true, message: "Email verified successfully." });
  } catch (error) {
    logger.error("Error verifying email", error);
    // Give specific, actionable messages instead of a generic 500.
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
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      if (req.bruteForceKey) {
        await recordFailure({
          keyPrefix: req.bruteForceKey.keyPrefix,
          identifier: req.bruteForceKey.identifier,
          failureWindowSeconds: runtimeConfig.rateLimit.authWindowSeconds,
          maxFailures: runtimeConfig.rateLimit.authMaxFailures,
          lockWindowSeconds: runtimeConfig.rateLimit.authLockWindowSeconds,
        });
      }

      return sendError(res, 401, "Invalid credentials.", {
        code: "INVALID_CREDENTIALS",
      });
    }

    // Check if user signed up via Google (no password)
    if (user.provider === "google" && !user.password) {
      return sendError(
        res,
        401,
        "This account uses Google Sign-In. Please use 'Sign in with Google'.",
        {
          code: "GOOGLE_ACCOUNT",
        },
      );
    }

    const isPasswordCorrect = await user.matchPassword(password);
    if (!isPasswordCorrect) {
      if (req.bruteForceKey) {
        const failure = await recordFailure({
          keyPrefix: req.bruteForceKey.keyPrefix,
          identifier: req.bruteForceKey.identifier,
          failureWindowSeconds: runtimeConfig.rateLimit.authWindowSeconds,
          maxFailures: runtimeConfig.rateLimit.authMaxFailures,
          lockWindowSeconds: runtimeConfig.rateLimit.authLockWindowSeconds,
        });

        if (failure.locked) {
          return sendError(
            res,
            429,
            "Too many failed login attempts. Please try again later.",
            {
              code: "AUTH_LOCKED",
              retryAfterSeconds: failure.retryAfterSeconds,
            },
          );
        }
      }

      return sendError(res, 401, "Invalid credentials.", {
        code: "INVALID_CREDENTIALS",
      });
    }

    // USING SHARED UTILITY — identical cookie settings as signup
    const token = generateToken(user._id);
    setAuthCookie(res, token);

    if (req.bruteForceKey) {
      await clearBruteForceTracking(req.bruteForceKey);
    }

    res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        profilePic: user.profilePic,
        nativeLanguage: user.nativeLanguage,
        learningLanguage: user.learningLanguage,
      },
    });
  } catch (error) {
    logger.error("Error in login controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function logout(req, res) {
  const token = req.cookies.jwt;

  // Clear cookie even if token is missing so logout stays idempotent.
  if (!token) {
    res.clearCookie("jwt");
    return res
      .status(200)
      .json({ success: true, message: "Logout successfully." });
  }

  try {
    const decoded = jwt.decode(token);
    const expiry = decoded?.exp
      ? decoded.exp - Math.floor(Date.now() / 1000)
      : 0;

    // Blacklist until natural JWT expiry (minimum 1 second).
    const ttl = expiry > 0 ? expiry : 1;
    await redis.set(`bl:${token}`, "1", "EX", ttl);
  } catch (error) {
    logger.error("Error while blacklisting token on logout", error);
  }

  res.clearCookie("jwt");
  return res
    .status(200)
    .json({ success: true, message: "Logout successfully." });
}

export async function onboard(req, res) {
  try {
    const userId = req.user._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...req.body,
        isOnboarded: true,
      },
      { new: true },
    ).select("-password");

    if (!updatedUser) {
      return sendError(res, 404, "User not found.", { code: "USER_NOT_FOUND" });
    }

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    logger.error("Onboarding error", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return sendError(res, 404, "User not found.", { code: "USER_NOT_FOUND" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    logger.error("Error fetching user", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
