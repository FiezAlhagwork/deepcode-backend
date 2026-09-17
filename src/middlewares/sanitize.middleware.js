/**
 * Recursively strips any object key that starts with "$" or contains "."
 * from `value` — the two characters that give a key special meaning inside
 * a Mongo query/update (operator injection, e.g. `{"$gt": ""}`, or a
 * dotted-path write like `"__proto__.polluted"`). Arrays are walked
 * element-by-element; every other value is returned as-is.
 *
 * Defense-in-depth only: every current route already validates `req.body`
 * with a Zod schema, which independently strips any key it didn't declare.
 * This exists as a second, schema-independent layer so a future route that
 * forgets to wire up `validate(...)` (as `reseller`'s routes once did,
 * before that was fixed — see CLAUDE.md) doesn't silently forward raw
 * operator-shaped input into a Mongo filter/update.
 */
export const stripMongoOperators = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripMongoOperators);
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      result[key] = stripMongoOperators(val);
    }
    return result;
  }

  return value;
};

// Sanitizes `req.body` in place before it reaches any route handler. Only
// `req.body` — `req.query`/`req.params` are already validated (and, on
// Express 5, read-only until `validate.middleware.js` replaces them) by the
// time any route-specific logic runs.
export const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = stripMongoOperators(req.body);
  }
  next();
};
