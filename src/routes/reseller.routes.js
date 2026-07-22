import { Router } from "express";
import { createCustomerOrder, getAccount, getProducts } from "../controllers/reseller.controller.js";

const router = Router();

router.get("/account", getAccount);
router.get("/products", getProducts);
router.post("/orders",createCustomerOrder);

export default router;
