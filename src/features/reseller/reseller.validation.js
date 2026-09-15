import { z } from "zod";

// GET /api/reseller/products — `type`/`category` are free-form tags defined
// by Hardbrain's own taxonomy (e.g. "kvm", "sale_2026"), not a local model,
// so there's no enum to validate against here. Just constrains them to
// plain, reasonably-sized strings before they're forwarded as query params
// to the external API, instead of letting arbitrary req.query shapes
// (including nested objects) through unchecked.
export const listProductsQuerySchema = z.object({
  type: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(100).optional(),
});
