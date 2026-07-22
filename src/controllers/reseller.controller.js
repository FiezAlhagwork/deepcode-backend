import {
  fetchAccountInfo,
  fetchProducts,
  createOrder,
} from "../services/hardbrain.js";

export const getAccount = async (req, res, next) => {
  try {
    const account = await fetchAccountInfo();

    return res.status(200).json({
      success: true,
      data: account,
    });
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

    return res.status(200).json({
      success: true,
      data: products,
    });
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
      return res.status(400).json({
        success: false,
        message: "product_id and customer_email are required",
      });
    }

    const order = await createOrder({
      product_id,
      customer_email,
      customer_name,
      quantity,
      external_reference,
      metadata,
    });

    return res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
