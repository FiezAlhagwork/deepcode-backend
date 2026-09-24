import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

// Shared by any feature that collects a phone number — currently `requests`
// and `contact`. Requires a full international number (a leading "+"); the
// frontend is expected to always compose one via a country-code selector, so
// there's no "assume a default country" fallback here — a bare local-format
// number (no "+") is rejected rather than guessed at. Valid input is
// normalized to E.164 (e.g. "+962791234567") before it's ever stored, so the
// same number always ends up in the database in exactly one shape regardless
// of how the caller formatted it (spaces, dashes, parens, etc.).
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required.")
  .transform((value, ctx) => {
    const parsed = parsePhoneNumberFromString(value);
    if (!parsed?.isValid()) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid phone number. Include the country code (e.g. +962...).",
      });
      return z.NEVER;
    }
    return parsed.format("E.164");
  });
