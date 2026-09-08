import { z } from "zod";

/**
 * Shared query-string schema for any paginated list endpoint. Apply via
 * `validate(paginationQuerySchema, "query")` on the route — `z.coerce`
 * turns the raw string query params into numbers, and `validate.middleware.js`
 * writes the parsed result back onto `req.query`.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

/**
 * Builds the `pagination` metadata object attached alongside `data` in a
 * paginated list response (see `sendSuccess`'s 5th argument).
 */
export const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 0,
});
