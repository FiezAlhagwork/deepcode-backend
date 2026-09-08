import { sendSuccess } from "../../utils/apiResponse.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import * as categoryService from "./category.service.js";

export const listCategories = async (req, res, next) => {
  try {
    const { page, limit, q } = req.query;
    const { categories, total } = await categoryService.listCategories({ page, limit, q });
    return sendSuccess(res, categories, undefined, 200, buildPaginationMeta({ page, limit, total }));
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    return sendSuccess(res, category);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body);
    return sendSuccess(res, category, "Category created.", 201);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    return sendSuccess(res, category, "Category updated.");
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const category = await categoryService.deleteCategory(req.params.id);
    return sendSuccess(res, category, "Category deleted.");
  } catch (error) {
    next(error);
  }
};
