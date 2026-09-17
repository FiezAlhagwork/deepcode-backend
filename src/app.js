import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { env } from "./config/env.js";
import resellerRoutes from "./features/reseller/reseller.routes.js";
import authRoutes from "./features/auth/auth.routes.js";
import usersRoutes from "./features/users/user.routes.js";
import webhookRoutes from "./features/users/webhook.routes.js";
import categoriesRoutes from "./features/categories/category.routes.js";
import projectsRoutes from "./features/projects/project.routes.js";
import uploadsRoutes from "./features/uploads/upload.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { sanitizeBody } from "./middlewares/sanitize.middleware.js";

const app = express();

// Trust the first hop in front of the app (reverse proxy/load balancer) so
// `req.ip`/`X-Forwarded-*` reflect the real client — required for
// express-rate-limit (below) to key limits by actual client IP instead of
// the proxy's IP in production. Harmless locally (no proxy present).
app.set("trust proxy", 1);

app.use(helmet());

// The localhost origin only ever ships in non-production environments — a
// production deploy must never allow CORS from a local dev address.
const corsOrigins = [
  "https://deepcodesolution.com",
  "https://www.deepcodesolution.com",
  ...(env.nodeEnv !== "production" ? ["http://localhost:3000"] : []),
];

app.use(cors({ origin: corsOrigins, credentials: true }));

// Mounted BEFORE express.json() below — Clerk's raw request body must reach
// verifyWebhook() untouched for signature verification to be reliable (see
// webhook.routes.js's express.raw()).
app.use("/api/webhooks", webhookRoutes);

// Explicit, reviewed value — same as Express's own default, but stated on
// purpose rather than relying on an implicit default.
app.use(express.json({ limit: "100kb" }));

// Defense-in-depth against Mongo operator injection (`$gt`, dotted-path
// writes, etc.) in any JSON request body, independent of each route's own
// Zod validation — see sanitize.middleware.js for the full reasoning.
app.use(sanitizeBody);

app.use(morgan("dev"));

app.use(clerkMiddleware());

// Blanket, light API-wide throttle — a baseline against scripted abuse.
// Feature-specific routes that need a tighter limit (e.g. reseller, which
// proxies a billable external API) apply their own stricter limiter on top
// of this one, inside that feature's own routes file.
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use("/api/reseller", resellerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/uploads", uploadsRoutes);

app.use(errorHandler);

export default app;
