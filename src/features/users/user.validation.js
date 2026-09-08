import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

export const inviteUserSchema = z.object({
  email: z.string().email("A valid email address is required."),
  role: z.enum(["admin", "super_admin"]),
});

// Demoting an admin back to "user" is a legitimate super_admin action, so
// all three roles are allowed here (unlike inviteUserSchema).
export const updateRoleSchema = z.object({
  role: z.enum(["user", "admin", "super_admin"]),
});

export const userIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user id."),
});

// GET /api/users — pagination plus optional filters.
export const listUsersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
  role: z.enum(["user", "admin", "super_admin"]).optional(),
});
