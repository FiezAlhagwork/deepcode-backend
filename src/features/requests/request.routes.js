import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { getAuth } from "@clerk/express";
import { requireAuth, requireRole } from "../auth/clerk.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { writeRateLimit } from "../../middlewares/writeRateLimit.middleware.js";
import {
  createRequestSchema,
  updateRequestStatusSchema,
  requestIdParamSchema,
  listRequestsQuerySchema,
} from "./request.validation.js";
import { createRequest, listRequests, updateRequestStatus } from "./request.controller.js";

const router = Router();

// Keyed by the authenticated caller (Clerk userId), not IP — the goal is
// capping how many requests a single account can submit, not IP volume,
// since multiple legitimate users can share an IP (office/NAT) while one
// account could otherwise just switch networks to bypass an IP-based limit.
// Falls back to IP only in the (should-be-impossible, requireAuth runs
// first) case there's no session.
const requestCreateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // ipKeyGenerator normalizes IPv6 addresses (collapses a /64 to one key)
  // so a caller can't dodge the fallback by cycling through addresses
  // within their own IPv6 block — express-rate-limit requires it for any
  // custom keyGenerator that falls back to req.ip.
  // getAuth(req), not `req.auth?.userId` — in @clerk/express v2 `req.auth` is
  // a function, so reading `.userId` off it is always undefined and silently
  // turns this into a plain per-IP limiter.
  keyGenerator: (req) => getAuth(req).userId ?? ipKeyGenerator(req.ip),
});

router.post(
  "/",
  requireAuth,
  requestCreateLimiter,
  validate(createRequestSchema),
  createRequest,
);

// Not requireRole-gated: every authenticated caller can hit this route, but
// what they get back differs by role — admins see every request, everyone
// else sees only their own (enforced server-side in request.service.js).
router.get("/", requireAuth, validate(listRequestsQuerySchema, "query"), listRequests);

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("admin", "super_admin"),
  writeRateLimit,
  validate(requestIdParamSchema, "params"),
  validate(updateRequestStatusSchema),
  updateRequestStatus,
);

export default router;
