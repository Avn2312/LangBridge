import { logger } from "../lib/logger.js";

const getUserId = (user) => {
  if (!user) {
    return undefined;
  }

  return user._id?.toString?.() || user.id?.toString?.() || user._id || user.id;
};

export const requestLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    logger.info("HTTP request completed", {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
      userId: getUserId(req.user),
    });
  });

  next();
};
