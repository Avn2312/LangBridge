import jwt from "jsonwebtoken";
import { logger } from "../../core/observability/logger.js";
import { sendEmail } from "../../services/mail.service.js";
import {
  clearBruteForceTracking,
  recordFailure,
} from "../../infrastructure/redis/rate-limit.store.js";
import {
  deleteCachePatterns,
  invalidateUserListCaches,
} from "../../infrastructure/redis/cache.store.js";
import { blacklistToken } from "../../infrastructure/redis/token-blacklist.store.js";
import { eventTopics } from "../../infrastructure/messaging/event-topics.js";
import { publishEvent } from "../../infrastructure/messaging/event-bus.js";
import {
  getBaseUrl,
  getFrontendUrl,
  runtimeConfig,
} from "../../config/env.js";
import { generateToken, generateVerificationToken } from "./auth.tokens.js";
import {
  serializeAuthSuccess,
  serializeCurrentUser,
  serializeOnboardingResult,
} from "./auth.dto.js";
import {
  createLocalUser,
  findUserByEmail,
  findUserByEmailWithPassword,
  findUserById,
  markUserVerified,
  updateOnboardingProfile,
} from "./auth.repository.js";

const createAuthError = (message, statusCode, code, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
};

const generateRandomAvatar = () => {
  const idx = Math.floor(Math.random() * 100) + 1;
  return `https://avatar.iran.liara.run/public/${idx}.png`;
};

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

const recordLoginFailure = async (bruteForceKey) => {
  if (!bruteForceKey) {
    return null;
  }

  return recordFailure({
    keyPrefix: bruteForceKey.keyPrefix,
    identifier: bruteForceKey.identifier,
    failureWindowSeconds: runtimeConfig.rateLimit.authWindowSeconds,
    maxFailures: runtimeConfig.rateLimit.authMaxFailures,
    lockWindowSeconds: runtimeConfig.rateLimit.authLockWindowSeconds,
  });
};

export async function signupUser({ email, password, fullName }) {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw createAuthError(
      "Email already exists, please use a different one.",
      400,
      "EMAIL_ALREADY_EXISTS",
    );
  }

  const newUser = await createLocalUser({
    email,
    fullName,
    password,
    profilePic: generateRandomAvatar(),
  });
  const token = generateToken(newUser._id);

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
    logger.error("Verification email failed to send", emailError);
  }

  publishEvent({
    topic: eventTopics.userSignedUp,
    key: newUser._id.toString(),
    payload: {
      userId: newUser._id.toString(),
      email: newUser.email,
      provider: newUser.provider,
      isOnboarded: newUser.isOnboarded,
    },
  });

  return {
    token,
    payload: serializeAuthSuccess({
      message: "Signup successful.",
      user: newUser,
    }),
  };
}

export async function resendUserVerificationEmail(userId) {
  const user = await findUserById(userId, "email fullName verified");

  if (!user) {
    throw createAuthError("User not found.", 404, "USER_NOT_FOUND");
  }

  if (user.verified) {
    throw createAuthError(
      "Your email is already verified.",
      400,
      "EMAIL_ALREADY_VERIFIED",
    );
  }

  const mailInfo = await sendVerificationEmail({
    userId: user._id,
    email: user.email,
    fullName: user.fullName,
  });

  return {
    success: true,
    message: "Verification email sent. Please check your inbox and spam folder.",
    messageId: mailInfo.messageId,
  };
}

export async function verifyUserEmail(token) {
  if (!token) {
    throw createAuthError(
      "Verification token is missing.",
      400,
      "VERIFICATION_TOKEN_MISSING",
    );
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  if (decoded.purpose !== "email-verification") {
    throw createAuthError(
      "Invalid token: wrong token type.",
      401,
      "VERIFICATION_TOKEN_TYPE_INVALID",
    );
  }

  const user = await findUserById(decoded.id);
  if (!user) {
    throw createAuthError("User not found.", 404, "USER_NOT_FOUND");
  }

  if (user.verified) {
    throw createAuthError(
      "Email is already verified.",
      400,
      "EMAIL_ALREADY_VERIFIED",
    );
  }

  await markUserVerified(decoded.id);
  return `${getFrontendUrl()}/login?verified=true`;
}

export async function loginUser({ email, password, bruteForceKey }) {
  const user = await findUserByEmailWithPassword(email);

  if (!user) {
    await recordLoginFailure(bruteForceKey);
    throw createAuthError("Invalid credentials.", 401, "INVALID_CREDENTIALS");
  }

  if (user.provider === "google" && !user.password) {
    throw createAuthError(
      "This account uses Google Sign-In. Please use 'Sign in with Google'.",
      401,
      "GOOGLE_ACCOUNT",
    );
  }

  const isPasswordCorrect = await user.matchPassword(password);
  if (!isPasswordCorrect) {
    const failure = await recordLoginFailure(bruteForceKey);
    if (failure?.locked) {
      throw createAuthError(
        "Too many failed login attempts. Please try again later.",
        429,
        "AUTH_LOCKED",
        { retryAfterSeconds: failure.retryAfterSeconds },
      );
    }

    throw createAuthError("Invalid credentials.", 401, "INVALID_CREDENTIALS");
  }

  if (bruteForceKey) {
    await clearBruteForceTracking(bruteForceKey);
  }

  return {
    token: generateToken(user._id),
    payload: serializeAuthSuccess({
      message: "Login successful.",
      user,
    }),
  };
}

export async function logoutUser(token) {
  if (!token) {
    return;
  }

  try {
    const decoded = jwt.decode(token);
    const expiry = decoded?.exp
      ? decoded.exp - Math.floor(Date.now() / 1000)
      : 0;
    const ttl = expiry > 0 ? expiry : 1;

    await blacklistToken({ token, ttlSeconds: ttl });
  } catch (error) {
    logger.error("Error while blacklisting token on logout", error);
  }
}

export async function onboardUser({ userId, body }) {
  const interests = Array.isArray(body.interests)
    ? body.interests
        .map((interest) => String(interest).trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const updatedUser = await updateOnboardingProfile({
    userId,
    profile: {
      fullName: body.fullName,
      bio: body.bio,
      nativeLanguage: body.nativeLanguage,
      learningLanguage: body.learningLanguage,
      location: body.location,
      profilePic: body.profilePic,
      timezone: body.timezone || "",
      proficiencyLevel: body.proficiencyLevel || "",
      interests,
    },
  });

  if (!updatedUser) {
    throw createAuthError("User not found.", 404, "USER_NOT_FOUND");
  }

  await Promise.all([
    invalidateUserListCaches([userId]),
    deleteCachePatterns(["langbridge:cache:recommendations:*"]),
  ]);

  publishEvent({
    topic: eventTopics.notificationSend,
    key: userId.toString(),
    payload: {
      userId: userId.toString(),
      type: "onboarding.completed",
      channel: "analytics",
    },
  });

  return serializeOnboardingResult(updatedUser);
}

export async function getCurrentUser(userId) {
  const user = await findUserById(userId, "-password");
  if (!user) {
    throw createAuthError("User not found.", 404, "USER_NOT_FOUND");
  }

  return serializeCurrentUser(user);
}
