import express, { Router } from "express";
import { handleClerkWebhook } from "./webhook.controller.js";

const router = Router();

// Raw Buffer body required for verifyWebhook()'s signature check — this
// router must be mounted before the global express.json() in app.js, or
// the body will already be parsed into an object by the time it gets here.
router.post("/clerk", express.raw({ type: "application/json" }), handleClerkWebhook);

export default router;
