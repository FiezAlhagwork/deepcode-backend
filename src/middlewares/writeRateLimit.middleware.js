import rateLimit from "express-rate-limit";

/**
 * Shared, stricter limiter for mutating (`POST`/`PATCH`/`DELETE`) routes —
 * used by categories, projects, users, and uploads, on top of the light
 * app-wide limiter in app.js. These routes already require `requireAuth` +
 * `requireRole`, so this isn't guarding against anonymous abuse; it caps how
 * much a single account (including a compromised or automated one) can
 * mutate data in a given window. Apply after `requireAuth`/`requireRole` on
 * each route, same ordering as the rest of that route's middleware chain.
 */
export const writeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
