import { logger } from "../observability/logger.js";
import { sendError } from "../http/api-response.js";

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || err.status || 500;

  logger.error("Unhandled request error", {
    method: req?.method,
    path: req?.originalUrl,
    statusCode,
    error: err,
  });

  return sendError(
    res,
    statusCode,
    statusCode === 500 ? "Internal Server Error." : err.message,
    {
      code: err.code,
      errors: err.errors,
    },
  );
};
