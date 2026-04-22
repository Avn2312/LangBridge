import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { sendError } from "../lib/apiResponse.js";

const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return sendError(res, 401, "Unauthorized - No token provided.", {
        code: "AUTH_TOKEN_MISSING",
      });
    }

    const isBlacklisted = await redis.get(`bl:${token}`);
    if (isBlacklisted) {
      return sendError(res, 401, "Unauthorized - Token has been revoked.", {
        code: "AUTH_TOKEN_REVOKED",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (!decoded) {
      return sendError(res, 401, "Unauthorized - Invalid token.", {
        code: "AUTH_TOKEN_INVALID",
      });
    }

    // .select("-password") removes password from the returned user object
    // WHY: We never want to send the hashed password to the frontend,
    //      even accidentally through req.user
    // 'id' matches the payload set by generateToken: { id: userId }
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return sendError(res, 401, "Unauthorized - User not found.", {
        code: "AUTH_USER_NOT_FOUND",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error("Error in protectRoute middleware", error);

    // Handle specific JWT errors for better debugging
    if (error.name === "JsonWebTokenError") {
      return sendError(res, 401, "Unauthorized - Malformed token.", {
        code: "AUTH_TOKEN_MALFORMED",
      });
    }
    if (error.name === "TokenExpiredError") {
      return sendError(res, 401, "Unauthorized - Token expired.", {
        code: "AUTH_TOKEN_EXPIRED",
      });
    }

    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
};

const requireVerifiedUser = (req, res, next) => {
  if (!req.user) {
    return sendError(
      res,
      401,
      "Unauthorized - User not found in request context.",
      {
        code: "AUTH_CONTEXT_MISSING",
      },
    );
  }

  if (!req.user.verified) {
    return sendError(
      res,
      403,
      "Please verify your email to use this feature.",
      {
        code: "EMAIL_NOT_VERIFIED",
      },
    );
  }

  next();
};

export { protectRoute, requireVerifiedUser };
