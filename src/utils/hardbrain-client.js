import axios from "axios";
import { env } from "../config/env.js";

export const hardbrainClient = axios.create({
  baseURL: env.hardbrain.baseUrl,
  headers: {
    "X-API-Key": env.hardbrain.apiKey,
    "X-API-Secret": env.hardbrain.apiSecret,
    "Content-Type": "application/json",
  },

  timeout: 15000,
});
