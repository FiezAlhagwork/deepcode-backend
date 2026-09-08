import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

const slugSchema = z
  .string()
  .min(1, "Slug is required.")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case (e.g. web-apps).");

export const createCategorySchema = z.object({
  name: z.object({
    ar: z.string().min(1, "Arabic name is required."),
    en: z.string().min(1, "English name is required."),
  }),
  slug: slugSchema,
});

// PATCH semantics: every field optional, but the body must not be empty.
export const updateCategorySchema = z
  .object({
    name: z
      .object({
        ar: z.string().min(1).optional(),
        en: z.string().min(1).optional(),
      })
      .optional(),
    slug: slugSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

export const categoryIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid category id."),
});

// GET /api/categories — pagination plus an optional free-text search.
export const listCategoriesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
});
