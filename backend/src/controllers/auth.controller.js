import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { redis } from "../lib/redis.js";
import {
  generateToken,
  generateVerificationToken,
  setAuthCookie,
} from "../lib/auth.utils.js";
import { sendEmail } from "../services/mail.service.js";

async function sendVerificationEmail({ userId, email, fullName }) {
  const verificationToken = generateVerificationToken(userId);
  const verifyUrl = `${process.env.BASE_URL || "http://localhost:3000"}/api/auth/verify-email?token=${verificationToken}`;

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
      return res
        .status(400)
        .json({ message: "Email already exists, please use a different one." });
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

      console.log("Verification email delivery status:", {
        userId: newUser._id.toString(),
        email,
        messageId: mailInfo.messageId,
        accepted: mailInfo.accepted,
        rejected: mailInfo.rejected,
      });
    } catch (emailError) {
      // Log but don't fail — user is created and has a valid session cookie.
      console.error("Verification email failed to send:", emailError.message);
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
    console.log("Error in signup controller:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
  }
}

export async function resendVerificationEmail(req, res) {
  try {
    const user = await User.findById(req.user._id).select(
      "email fullName verified",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.verified) {
      return res
        .status(400)
        .json({ message: "Your email is already verified." });
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
    console.error(
      "Error in resendVerificationEmail controller:",
      error.message,
    );
    return res
      .status(500)
      .json({ message: "Could not resend verification email." });
  }
}

export async function verifyEmail(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: "Verification token is missing." });
  }

  try {
    // Verify signature + expiry in one call. Throws on failure.
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // SECURITY: Ensure this is a verification token, not a stolen session token.
    // Session tokens have no 'purpose' claim; verification tokens have
    // purpose: "email-verification" baked in by generateVerificationToken().
    if (decoded.purpose !== "email-verification") {
      return res
        .status(401)
        .json({ message: "Invalid token: wrong token type." });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Guard: prevent processing a link that was already used.
    if (user.verified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    user.verified = true;
    await user.save();

    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?verified=true`,
    );

    // res.status(200).json({ success: true, message: "Email verified successfully." });
  } catch (error) {
    console.error("Error verifying email:", error.message);
    // Give specific, actionable messages instead of a generic 500.
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Verification link has expired. Please request a new one.",
      });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid verification token." });
    }
    res.status(500).json({ message: "Internal Server Error." });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Check if user signed up via Google (no password)
    if (user.provider === "google" && !user.password) {
      return res.status(401).json({
        message:
          "This account uses Google Sign-In. Please use 'Sign in with Google'.",
      });
    }

    const isPasswordCorrect = await user.matchPassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // USING SHARED UTILITY — identical cookie settings as signup
    const token = generateToken(user._id);
    setAuthCookie(res, token);

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
    console.log("Error in login controller:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
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
    console.error("Error while blacklisting token on logout:", error.message);
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
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Onboarding error:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
  }
}

export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
  }
}
