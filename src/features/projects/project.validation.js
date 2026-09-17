import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination.js";

const bilingual = z.object({
  ar: z.string().min(1).max(200, "Must be 200 characters or fewer."),
  en: z.string().min(1).max(200, "Must be 200 characters or fewer."),
});
const bilingualDescription = z.object({
  ar: z.string().min(1).max(2000, "Must be 2000 characters or fewer."),
  en: z.string().min(1).max(2000, "Must be 2000 characters or fewer."),
});
const slugSchema = z
  .string()
  .min(1, "Slug is required.")
  .max(100, "Slug must be 100 characters or fewer.")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case.");
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id.");
const urlSchema = z.string().url().max(2000, "URL must be 2000 characters or fewer.");

// `publicId` is optional/unused by the client — it's injected server-side by
// project.multipart.js from Cloudinary's upload result. It must still be
// declared here, though: Zod strips any key not listed in an object schema,
// so omitting it would silently erase it before it ever reaches the
// database, breaking DELETE /api/projects/:id/gallery/:imageId's cleanup.
const galleryItemSchema = z.object({
  image: urlSchema,
  publicId: z.string().max(200).optional(),
  order: z.number(),
});

const linkSchema = z.object({
  type: z.string().min(1).max(50, "Must be 50 characters or fewer."),
  url: urlSchema,
});

export const createProjectSchema = z.object({
  name: bilingual,
  slug: slugSchema,
  description: bilingualDescription,
  coverImage: urlSchema,
  gallery: z.array(galleryItemSchema).optional().default([]),
  links: z.array(linkSchema).optional().default([]),
  category: objectIdSchema,
  status: z.enum(["draft", "published"]).optional().default("draft"),
  // coerce: multipart/form-data always delivers this as a string.
  order: z.coerce.number().optional().default(0),
});

// PATCH semantics: every field optional, but the body must not be empty.
export const updateProjectSchema = z
  .object({
    name: bilingual.optional(),
    slug: slugSchema.optional(),
    description: bilingualDescription.optional(),
    coverImage: urlSchema.optional(),
    gallery: z.array(galleryItemSchema).optional(),
    links: z.array(linkSchema).optional(),
    category: objectIdSchema.optional(),
    status: z.enum(["draft", "published"]).optional(),
    order: z.coerce.number().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

export const projectIdParamSchema = z.object({ id: objectIdSchema });

export const projectGalleryParamSchema = z.object({
  id: objectIdSchema,
  imageId: objectIdSchema,
});

// GET /api/projects — pagination plus optional filters. `status` is only
// ever honored for a caller who can already see drafts (checked in
// project.controller.js) — a public caller passing ?status=draft must never
// be able to see unpublished content just by asking for it.
export const listProjectsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
  status: z.enum(["draft", "published"]).optional(),
  category: objectIdSchema.optional(),
});

// No Zod schema for the `:id` route param on GET /api/projects/:id — its
// shape (ObjectId vs. slug) is exactly what decides which field to match
// against in the controller, and a value matching neither simply falls
// through the natural findOne(...) -> null -> 404 flow, so validating it
// here would only add ceremony.
