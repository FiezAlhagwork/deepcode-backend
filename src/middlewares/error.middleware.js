import multer from "multer";
import { AppError } from "../utils/AppError.js";
import { sendError } from "../utils/apiResponse.js";

const MULTER_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: "File is too large.",
  LIMIT_FILE_COUNT: "Too many files.",
  LIMIT_UNEXPECTED_FILE: "Unexpected file field.",
};

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

  // Multer's own upload-limit errors (file too large, too many files, wrong
  // field name) — thrown as `multer.MulterError`, not `AppError`, from
  // wherever `upload.fields()`/`upload.single()` runs (project.multipart.js,
  // uploads/upload.routes.js). Handled once, generically, here rather than
  // per-feature, same as the E11000 branch below.
  if (err instanceof multer.MulterError) {
    const message = MULTER_ERROR_MESSAGES[err.code] ?? "File upload failed.";
    return sendError(res, message, 400, err.code);
  }

  // MongoDB/Mongoose duplicate-key error (E11000) — e.g. a Category or
  // Project slug that already exists. Surfaced by the driver as
  // `err.code === 11000` on both `.create()`/`.save()` and `updateOne`-style
  // operations, regardless of which feature/model triggered it, so it's
  // handled once, generically, here rather than duplicated per-controller.
  if (err.code === 11000) {
    // Field name only, not the colliding value itself — the value isn't
    // needed to act on this error, and not echoing it back avoids using
    // this response as a way to enumerate/confirm exact existing values.
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    return sendError(res, `A record with this ${field} already exists.`, 409, "DUPLICATE_KEY");
  }

  console.error(err.stack);

  return sendError(
    res,
    "Something went wrong. Please try again later.",
    500,
    "INTERNAL_ERROR",
  );
};
