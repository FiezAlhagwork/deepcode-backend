/**
 * Standard API response helpers.
 *
 * `sendSuccess` is the one every controller should call for a successful
 * response — see CLAUDE.md's mandated response shape.
 *
 * `sendError` builds the mandated error shape and is used internally by
 * `middlewares/error.middleware.js` only. Controllers must never call it
 * directly — throw an `AppError` and call `next(err)` instead, so every
 * error response goes through the single central error handler.
 */

export const sendSuccess = (res, data = null, message, statusCode = 200, pagination) => {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(message && { message }),
    ...(pagination && { pagination }),
  });
};


export const sendError = (res, message, statusCode = 500, code) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(code && { code }),
    },
  });
};
