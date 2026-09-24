import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { phoneSchema } from "../../utils/phone.js";

// Product fields are a client-submitted snapshot of the Hardbrain product the
// requester was looking at (name/price at request time), not re-verified
// against the live catalog — the frontend only ever shows this form right
// after fetching that same live catalog, so there's no meaningful window for
// it to go stale. See CLAUDE.md Decisions Log for the full reasoning.
export const createRequestSchema = z.object({
  productId: z.string().trim().min(1).max(200),
  productName: z.string().trim().min(1).max(200),
  productPrice: z.coerce.number().nonnegative(),
  productBasePrice: z.coerce.number().nonnegative().optional(),
  billingCycle: z.string().trim().max(50).optional(),
  requestType: z.enum(["purchase", "inquiry"]),
  phone: phoneSchema,
  notes: z.string().trim().max(1000).optional(),
});

export const updateRequestStatusSchema = z.object({
  status: z.enum(["pending", "contacted"]),
});

export const requestIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid request id."),
});

// GET /api/requests — pagination plus an optional status filter. Which
// requests this actually matches (all of them vs. only the caller's own) is
// decided by role in request.service.js#listRequests, not here.
export const listRequestsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["pending", "contacted"]).optional(),
});
