import { hardbrainClient } from "./hardbrain-client.js";

export const fetchAccountInfo = async () => {
  const { data } = await hardbrainClient.get("/account");

  return data;
};

export const fetchProducts = async (filters = {}) => {
  const { data } = await hardbrainClient.get("/products", {
    params: filters,
  });

  const products = Array.isArray(data) ? data : data?.data?.products;

  if (Array.isArray(products)) {
    products.sort((a, b) => a.base_price - b.base_price);
  }

  return data;
};
