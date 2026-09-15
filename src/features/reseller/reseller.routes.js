import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../../middlewares/validate.middleware.js";
import { getAccount, getProducts } from "./reseller.controller.js";
import { listProductsQuerySchema } from "./reseller.validation.js";

const router = Router();

// Both routes are public/unauthenticated by design (see CLAUDE.md), and
// every request proxies straight through to the external, billable
// Hardbrain API with no caching — so this stays tighter than the app-wide
// limiter in app.js to keep an anonymous caller from running up the
// Hardbrain bill or exhausting its quota.
const resellerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/account", resellerLimiter, getAccount);
router.get("/products", resellerLimiter, validate(listProductsQuerySchema, "query"), getProducts);

export default router;
