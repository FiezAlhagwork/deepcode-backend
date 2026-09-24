import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { phoneSchema } from "../../utils/phone.js";

// `website` is a honeypot, not a real field: a hidden input the frontend
// keeps empty/off-screen via CSS for real visitors, but a simple bot that
// auto-fills every field will fill it. Declared here (rather than just
// ignored) so it survives validate()'s strip-unknown-keys behavior and
// reaches the controller, which checks it *before* calling the service —
// see contact.controller.js. It is never persisted (contact.model.js has no
// matching field, and the controller never passes it through anyway).
export const createContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  email: z.string().trim().toLowerCase().email("A valid email address is required.").max(254),
  phone: phoneSchema,
  message: z.string().trim().min(1, "Message is required.").max(2000),
  website: z.string().max(200).optional(),
});

export const updateContactStatusSchema = z.object({
  status: z.enum(["pending", "contacted"]),
});

export const contactIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid contact message id."),
});

export const listContactQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["pending", "contacted"]).optional(),
});
