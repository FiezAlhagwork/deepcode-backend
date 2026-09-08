import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { clerkMiddleware } from "@clerk/express";
import resellerRoutes from "./features/reseller/reseller.routes.js";
import authRoutes from "./features/auth/auth.routes.js";
import usersRoutes from "./features/users/user.routes.js";
import webhookRoutes from "./features/users/webhook.routes.js";
import categoriesRoutes from "./features/categories/category.routes.js";
import projectsRoutes from "./features/projects/project.routes.js";
import uploadsRoutes from "./features/uploads/upload.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: ["https://deepcodesolution.com", "https://www.deepcodesolution.com"],
    credentials: true,
  }),
);

// Mounted BEFORE express.json() below — Clerk's raw request body must reach
// verifyWebhook() untouched for signature verification to be reliable (see
// webhook.routes.js's express.raw()).
app.use("/api/webhooks", webhookRoutes);

app.use(express.json());

app.use(morgan("dev"));

app.use(clerkMiddleware());

app.use("/api/reseller", resellerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/uploads", uploadsRoutes);

app.use(errorHandler);

export default app;
