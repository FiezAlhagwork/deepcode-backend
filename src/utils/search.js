export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds a case-insensitive `$or` regex filter across the given dot-path
 * fields (e.g. "name.en") for a free-text `q` search query param. Returns
 * `{}` (a no-op filter, safe to spread into any Mongo query) if `q` is
 * falsy — so callers never need to branch on whether `q` was provided.
 */
export const buildSearchFilter = (fields, q) => {
  if (!q) return {};
  const pattern = new RegExp(escapeRegex(q), "i");
  return { $or: fields.map((field) => ({ [field]: pattern })) };
};
