import { Router } from "express";
import { requireAuth, requireRole } from "../auth/clerk.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  inviteUserSchema,
  updateRoleSchema,
  userIdParamSchema,
  listUsersQuerySchema,
} from "./user.validation.js";
import { getUsers, createInvitedUser, patchUserRole, deleteUser } from "./user.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", requireRole("admin", "super_admin"), validate(listUsersQuerySchema, "query"), getUsers);

router.post("/", requireRole("super_admin"), validate(inviteUserSchema), createInvitedUser);

router.patch(
  "/:id/role",
  requireRole("super_admin"),
  validate(userIdParamSchema, "params"),
  validate(updateRoleSchema),
  patchUserRole,
);

router.delete(
  "/:id",
  requireRole("super_admin"),
  validate(userIdParamSchema, "params"),
  deleteUser,
);

export default router;
