import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { redis } from "../lib/redis.js";

const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No token provided." });
    }

    const isBlacklisted = await redis.get(`bl:${token}`);
    if (isBlacklisted) {
      return res
        .status(401)
        .json({ message: "Unauthorized - Token has been revoked." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid token." });
    }

    // .select("-password") removes password from the returned user object
    // WHY: We never want to send the hashed password to the frontend,
    //      even accidentally through req.user
    // 'id' matches the payload set by generateToken: { id: userId }
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ message: "Unauthorized - User not found." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware:", error.message);

    // Handle specific JWT errors for better debugging
    if (error.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ message: "Unauthorized - Malformed token." });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Unauthorized - Token expired." });
    }

    res.status(500).json({ message: "Internal Server Error." });
  }
};

const requireVerifiedUser = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ message: "Unauthorized - User not found in request context." });
  }

  if (!req.user.verified) {
    return res.status(403).json({
      message: "Please verify your email to use this feature.",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  next();
};

export { protectRoute, requireVerifiedUser };
