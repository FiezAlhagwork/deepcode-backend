import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole } from "../auth/clerk.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { writeRateLimit } from "../../middlewares/writeRateLimit.middleware.js";
import {
  createContactSchema,
  updateContactStatusSchema,
  contactIdParamSchema,
  listContactQuerySchema,
} from "./contact.validation.js";
import {
  createContactMessage,
  listContactMessages,
  updateContactStatus,
} from "./contact.controller.js";

const router = Router();

// Plain IP-based keying (express-rate-limit's default) — there's no session
// to key by, this route is public by design.
const contactCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

// Public — no requireAuth. Any site visitor can submit a contact message.
router.post("/", contactCreateLimiter, validate(createContactSchema), createContactMessage);

router.get(
  "/",
  requireAuth,
  requireRole("admin", "super_admin"),
  validate(listContactQuerySchema, "query"),
  listContactMessages,
);

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("admin", "super_admin"),
  writeRateLimit,
  validate(contactIdParamSchema, "params"),
  validate(updateContactStatusSchema),
  updateContactStatus,
);

export default router;
