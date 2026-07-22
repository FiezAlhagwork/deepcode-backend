import { hardbrainClient } from "../utils/hardbrain-client.js";

export const fetchAccountInfo = async () => {
  const { data } = await hardbrainClient.get("/account");

  return data;
};

export const fetchProducts = async (filters = {}) => {
  const { data } = await hardbrainClient.get("/products", {
    params: filters,
  });

  return data;
};

export const createOrder = async (orderData) => {
  const { data } = await hardbrainClient.post("/orders", orderData);

  return data;
};
