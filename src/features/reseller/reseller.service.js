import { AppError } from "../../utils/AppError.js";
import { hardbrainClient } from "./hardbrain-client.js";

// Hardbrain being down/slow is an upstream failure, not a bug in this app —
// surface it as a 502 instead of letting the axios error fall through to the
// generic 500 branch in error.middleware.js.
const callHardbrain = async (path, config) => {
  try {
    const { data } = await hardbrainClient.get(path, config);
    return data;
  } catch (error) {
    console.error(`Hardbrain ${path} failed:`, error.message);
    throw new AppError("The hosting provider is currently unavailable.", 502, "UPSTREAM_ERROR");
  }
};

export const fetchAccountInfo = () => callHardbrain("/account");

export const fetchProducts = async (filters = {}) => {
  const data = await callHardbrain("/products", { params: filters });

  const products = Array.isArray(data) ? data : data?.data?.products;

  if (Array.isArray(products)) {
    products.sort((a, b) => a.base_price - b.base_price);
  }

  return data;
};
