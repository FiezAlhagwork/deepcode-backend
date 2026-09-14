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
  mongodb: process.env.MONGODB_URI,

  // No fail-fast here — the localhost default is fine for local dev; in
  // production this must be set to the real site URL (used as the Clerk
  // invitation redirect target and, indirectly, for CORS).
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    webhookSigningSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};

if (!env.clerk.secretKey) {
  console.error("❌ Missing required env var: CLERK_SECRET_KEY. Clerk auth will not function.");
  process.exit(1);
}

if (!env.clerk.webhookSigningSecret) {
  console.error(
    "❌ Missing required env var: CLERK_WEBHOOK_SIGNING_SECRET. Clerk webhook verification will not function.",
  );
  process.exit(1);
}

if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
  console.error(
    "❌ Missing required env var(s): CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET. Image uploads will not function.",
  );
  process.exit(1);
}
