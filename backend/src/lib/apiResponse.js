export const sendError = (res, statusCode, message, extra = {}) => {
  const payload = {
    success: false,
    message,
    ...extra,
  };

  return res.status(statusCode).json(payload);
};

export const createAppError = (message, statusCode = 500, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};
