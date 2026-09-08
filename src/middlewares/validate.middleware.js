import { AppError } from "../utils/AppError.js";

/**
 * Generic Zod-validation middleware factory.
 *
 * `validate(schema)` validates `req.body` by default. Pass `"params"` or
 * `"query"` as the second argument to validate those instead. Chain two
 * `validate()` calls on the same route if more than one source needs
 * validating.
 *
 * On failure, throws an `AppError(message, 400, "VALIDATION_ERROR")` so it
 * flows through the standard error pipeline. On success, `req[source]` is
 * replaced with the parsed data so `.default()` / `.transform()` /
 * `.coerce` schemas take effect downstream.
 */
export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
      .join("; ");

    return next(new AppError(message, 400, "VALIDATION_ERROR"));
  }

  if (source === "query") {
    // Express 5 exposes `req.query` as a getter-only accessor, so a plain
    // assignment throws. Shadow it on this request instance instead.
    Object.defineProperty(req, "query", {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } else {
    req[source] = result.data;
  }

  next();
};
