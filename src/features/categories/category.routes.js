import { Router } from "express";
import { requireAuth, requireRole } from "../auth/clerk.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  listCategoriesQuerySchema,
} from "./category.validation.js";
import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./category.controller.js";

const router = Router();

router.get("/", validate(listCategoriesQuerySchema, "query"), listCategories); // public

router.get("/:id", validate(categoryIdParamSchema, "params"), getCategoryById); // public

router.post(
  "/",
  requireAuth,
  requireRole("admin", "super_admin"),
  validate(createCategorySchema),
  createCategory,
);

router.patch(
  "/:id",
  requireAuth,
  requireRole("admin", "super_admin"),
  validate(categoryIdParamSchema, "params"),
  validate(updateCategorySchema),
  updateCategory,
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "super_admin"),
  validate(categoryIdParamSchema, "params"),
  deleteCategory,
);

export default router;
