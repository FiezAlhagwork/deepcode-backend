import { Router } from "express";
import { requireAuth } from "./clerk.middleware.js";
import { getCurrentUser } from "./auth.controller.js";

const router = Router();

router.get("/me", requireAuth, getCurrentUser);

export default router;
