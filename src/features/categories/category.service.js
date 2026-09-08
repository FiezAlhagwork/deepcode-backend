import { AppError } from "../../utils/AppError.js";
import { buildSearchFilter } from "../../utils/search.js";
import { Category } from "./category.model.js";
import { Project } from "../projects/project.model.js";

export const listCategories = async ({ page, limit, q }) => {
  const filter = buildSearchFilter(["name.ar", "name.en", "slug"], q);
  const skip = (page - 1) * limit;
  const [categories, total] = await Promise.all([
    Category.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter),
  ]);
  return { categories, total };
};

export const getCategoryById = async (id) => {
  const category = await Category.findById(id).lean();
  if (!category) throw new AppError("Category not found.", 404, "CATEGORY_NOT_FOUND");
  return category;
};

export const createCategory = (data) => Category.create(data);

export const updateCategory = async (id, data) => {
  const category = await Category.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  if (!category) throw new AppError("Category not found.", 404, "CATEGORY_NOT_FOUND");
  return category;
};

export const deleteCategory = async (id) => {
  // Never allow deleting a category that's still assigned to a project —
  // no cascade, no force-delete.
  const inUse = await Project.exists({ category: id });
  if (inUse) {
    throw new AppError(
      "This category is still assigned to one or more projects and cannot be deleted.",
      409,
      "CATEGORY_IN_USE",
    );
  }

  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new AppError("Category not found.", 404, "CATEGORY_NOT_FOUND");
  return category;
};
