import { fetchAccountInfo, fetchProducts } from "./reseller.service.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export const getAccount = async (req, res, next) => {
  try {
    const account = await fetchAccountInfo();

    return sendSuccess(res, account);
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (req, res, next) => {
  try {
    const { type, category } = req.query;
    const filters = {};

    if (type) filters.type = type;
    if (category) filters.category = category;

    const products = await fetchProducts(filters);

    return sendSuccess(res, products);
  } catch (error) {
    next(error);
  }
};
