import { AppError } from "../../utils/AppError.js";
import { buildSearchFilter } from "../../utils/search.js";
import { cloudinary, destroyCloudinaryAssets } from "../../utils/cloudinary.js";
import { Project } from "./project.model.js";
import { Category } from "../categories/category.model.js";

const assertCategoryExists = async (categoryId) => {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new AppError("Referenced category does not exist.", 404, "CATEGORY_NOT_FOUND");
  }
};

export const listProjects = async (showDrafts, { page, limit, q, status, category }) => {
  // `status` is only ever honored when the caller can already see drafts
  // (decided by project.controller.js's canSeeDrafts) — a public caller
  // can never use ?status=draft to see unpublished content just by asking.
  const visibilityFilter = showDrafts ? (status ? { status } : {}) : { status: "published" };

  const filter = {
    ...visibilityFilter,
    ...(category && { category }),
    ...buildSearchFilter(["name.ar", "name.en", "slug"], q),
  };

  const skip = (page - 1) * limit;
  const [projects, total] = await Promise.all([
    Project.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("category")
      .lean(),
    Project.countDocuments(filter),
  ]);
  return { projects, total };
};

// Shared by getProjectBySlug/getProjectById below — same visibility rule and
// the same deliberately identical 404 whether the project truly doesn't
// exist or exists but is a draft an unauthorized caller can't see (no
// information leak that a draft with this id/slug exists).
const findVisibleProject = async (matchFilter, showDrafts) => {
  const filter = { ...matchFilter, ...(showDrafts ? {} : { status: "published" }) };
  const project = await Project.findOne(filter).populate("category").lean();
  if (!project) throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  return project;
};

export const getProjectBySlug = (slug, showDrafts) => findVisibleProject({ slug }, showDrafts);

export const getProjectById = (id, showDrafts) => findVisibleProject({ _id: id }, showDrafts);

export const createProject = async (data) => {
  await assertCategoryExists(data.category);
  return Project.create(data);
};

// `newGalleryItems` ({image, publicId} each) are appended with an atomic
// $push, never by rewriting the whole array — so a concurrent PATCH or
// gallery-image DELETE can't be lost or silently undone by this one.
export const updateProject = async (id, data, newGalleryItems = []) => {
  if (Object.keys(data).length === 0 && newGalleryItems.length === 0) {
    throw new AppError("At least one field must be provided to update.", 400, "VALIDATION_ERROR");
  }

  const existing = await Project.findById(id).select("coverImagePublicId gallery.order").lean();
  if (!existing) throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");

  if (data.category) await assertCategoryExists(data.category);

  const update = Object.keys(data).length ? { $set: data } : {};
  if (newGalleryItems.length) {
    const startOrder = existing.gallery.reduce((max, item) => Math.max(max, item.order), 0);
    update.$push = {
      gallery: {
        $each: newGalleryItems.map((item, index) => ({ ...item, order: startOrder + index + 1 })),
      },
    };
  }

  const project = await Project.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });
  if (!project) throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");

  // The cover was replaced — its old asset is no longer referenced anywhere.
  if (data.coverImagePublicId && existing.coverImagePublicId !== data.coverImagePublicId) {
    await destroyCloudinaryAssets([existing.coverImagePublicId]);
  }

  return project;
};

// Hard delete — unlike the `users` feature's soft-delete, a Project has no
// referential-integrity or audit-history requirement (nothing else
// foreign-keys to it), so removing it from the site should actually remove it
// — including its cover/gallery assets on Cloudinary.
export const deleteProject = async (id) => {
  const project = await Project.findByIdAndDelete(id);
  if (!project) throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");

  await destroyCloudinaryAssets([
    project.coverImagePublicId,
    ...project.gallery.map((item) => item.publicId),
  ]);
  return project;
};

// Removes exactly one gallery image (identified by its subdocument _id),
// leaving the rest of the gallery and every other field untouched. This is
// the only supported way to drop an image from an existing gallery — PATCH
// only ever appends new uploads, on purpose (see project.multipart.js).
export const removeGalleryImage = async (projectId, imageId) => {
  const project = await Project.findById(projectId);
  if (!project) throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");

  const image = project.gallery.find((item) => String(item._id) === imageId);
  if (!image) throw new AppError("Gallery image not found.", 404, "GALLERY_IMAGE_NOT_FOUND");

  if (image.publicId) {
    try {
      await cloudinary.uploader.destroy(image.publicId);
    } catch (error) {
      // Best-effort: an orphaned Cloudinary asset is a minor storage cost,
      // not worth failing the whole request over — the record is still
      // removed from the project below either way.
      console.error(`Failed to delete Cloudinary asset ${image.publicId}:`, error.message);
    }
  }

  return Project.findByIdAndUpdate(
    projectId,
    { $pull: { gallery: { _id: imageId } } },
    { new: true },
  ).populate("category");
};
