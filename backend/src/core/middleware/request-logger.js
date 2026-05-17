import { logger } from "../observability/logger.js";
import { observeHttpRequest } from "../observability/metrics.js";

const getUserId = (user) => {
  if (!user) {
    return undefined;
  }

  return user._id?.toString?.() || user.id?.toString?.() || user._id || user.id;
};

export const requestLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const route = req.route?.path || req.path || "unknown";

    observeHttpRequest({
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs,
    });

    logger.info("HTTP request completed", {
      requestId: req.id,
      traceId: req.traceId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      userId: getUserId(req.user),
    });
  });

  next();
};
