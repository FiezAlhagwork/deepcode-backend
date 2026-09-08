/**
 * Custom operational error class.
 *
 * Use this for expected/handled failure cases (validation, not-found,
 * forbidden, etc.) and always pass it to `next(err)` — never respond
 * directly from a controller. The central `error.middleware.js` reads
 * `statusCode` / `message` / `code` off instances of this class and
 * formats the final JSON response.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
