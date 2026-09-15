import dotenv from "dotenv";

dotenv.config();

const KNOWN_NODE_ENVS = new Set(["development", "production", "test"]);

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

if (!env.mongodb) {
  console.error("❌ Missing required env var: MONGODB_URI. The app cannot connect to the database.");
  process.exit(1);
}

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

// Not fail-fast (a typo'd/custom NODE_ENV shouldn't crash the process), but
// loudly flagged: app.js's CORS localhost-origin allowlist gates purely on
// `env.nodeEnv !== "production"`, so a misspelled/unset NODE_ENV in a real
// production deploy (e.g. "produciton") would silently leave the localhost
// dev origin allowed in production instead of failing safe.
if (!KNOWN_NODE_ENVS.has(env.nodeEnv)) {
  console.warn(
    `⚠️  NODE_ENV is set to "${env.nodeEnv}", not one of ${[...KNOWN_NODE_ENVS].join("/")}. ` +
      `This is treated as non-production (e.g. the CORS localhost origin stays allowed) — ` +
      `if this is a production deploy, fix NODE_ENV to "production".`,
  );
}

// Same reasoning as above: not fail-fast (localhost is a legitimate default
// for local dev), but a silent localhost default in production breaks Clerk
// invitation redirect links for real users, so it's worth a loud warning.
if (env.nodeEnv === "production" && !process.env.FRONTEND_URL) {
  console.warn(
    "⚠️  FRONTEND_URL is not set in a production environment — Clerk invitation emails will " +
      "redirect to http://localhost:3000 instead of the real site.",
  );
}
