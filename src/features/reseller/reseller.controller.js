import {
  fetchAccountInfo,
  fetchProducts,
  createOrder,
} from "./reseller.service.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { AppError } from "../../utils/AppError.js";

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

export const createCustomerOrder = async (req, res, next) => {
  try {
    const {
      product_id,
      customer_email,
      customer_name,
      quantity,
      external_reference,
      metadata,
    } = req.body;

    if (!product_id || !customer_email) {
      throw new AppError("product_id and customer_email are required", 400, "VALIDATION_ERROR");
    }

    const order = await createOrder({
      product_id,
      customer_email,
      customer_name,
      quantity,
      external_reference,
      metadata,
    });

    return sendSuccess(res, order, undefined, 201);
  } catch (error) {
    next(error);
  }
};
