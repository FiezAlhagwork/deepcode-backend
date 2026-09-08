import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err.message);
});

/**
 * Establishes the single Mongoose connection for the app. Called once from
 * `server.js` at startup. Exits the process on failure so the server never
 * comes up in a broken, DB-less state.
 */
export const connectDB = async () => {
  try {
    await mongoose.connect(env.mongodb, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};
