import { Router } from "express";
import { requireAuth, requireRole } from "../auth/clerk.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { uploadProjectImages, normalizeProjectMultipart } from "./project.multipart.js";
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdParamSchema,
  projectGalleryParamSchema,
  listProjectsQuerySchema,
} from "./project.validation.js";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  deleteGalleryImage,
} from "./project.controller.js";

const router = Router();

router.get("/", validate(listProjectsQuerySchema, "query"), listProjects); // public, draft-visibility handled in controller
router.get("/:id", getProject); // public, draft-visibility handled in controller; :id may be an ObjectId or a slug

// multipart/form-data: coverImage/gallery are real files, uploaded to
// Cloudinary by normalizeProjectMultipart before the usual Zod validation
// runs — see project.multipart.js for the full request-shape contract.
router.post(
  "/",
  requireAuth,
  requireRole("admin", "super_admin"),
  uploadProjectImages,
  normalizeProjectMultipart,
  validate(createProjectSchema),
  createProject,
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "super_admin"),
  validate(projectIdParamSchema, "params"),
  uploadProjectImages,
  normalizeProjectMultipart,
  validate(updateProjectSchema),
  updateProject,
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "super_admin"),
  validate(projectIdParamSchema, "params"),
  deleteProject,
);

// Removes exactly one gallery image, leaving the rest untouched — the only
// supported way to drop an image (PATCH only ever appends new uploads).
router.delete(
  "/:id/gallery/:imageId",
  requireAuth,
  requireRole("admin", "super_admin"),
  validate(projectGalleryParamSchema, "params"),
  deleteGalleryImage,
);

export default router;
