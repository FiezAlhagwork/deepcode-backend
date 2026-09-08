import { AppError } from "../utils/AppError.js";
import { sendError } from "../utils/apiResponse.js";

/**
 * Central error handler — the single place every error in the app flows
 * through. `AppError` instances (expected/operational failures) are
 * reported as-is. Anything else (bugs, DB errors, etc.) is logged in full
 * server-side but returned to the client as a generic 500 with no leaked
 * internals.
 */
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error(`[${req.method}] ${req.originalUrl} -> ${err.statusCode ?? 500}: ${err.message}`);

  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.code);
  }

  // MongoDB/Mongoose duplicate-key error (E11000) — e.g. a Category or
  // Project slug that already exists. Surfaced by the driver as
  // `err.code === 11000` on both `.create()`/`.save()` and `updateOne`-style
  // operations, regardless of which feature/model triggered it, so it's
  // handled once, generically, here rather than duplicated per-controller.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    const value = err.keyValue?.[field];
    return sendError(res, `A record with ${field} "${value}" already exists.`, 409, "DUPLICATE_KEY");
  }

  console.error(err.stack);

  return sendError(
    res,
    "Something went wrong. Please try again later.",
    500,
    "INTERNAL_ERROR",
  );
};
