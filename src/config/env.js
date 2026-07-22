import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT) || 5000,

  hardbrain: {
    baseUrl: process.env.HARDBRAIN_BASE_URL,
    apiKey: process.env.HARDBRAIN_API_KEY,
    apiSecret: process.env.HARDBRAIN_API_SECRET,
  },
  mongodb: process.env.MONGO_URI,
};
