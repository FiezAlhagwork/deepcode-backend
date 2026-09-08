import mongoose from "mongoose";

const { Schema, model } = mongoose;

const categorySchema = new Schema(
  {
    name: {
      ar: { type: String, required: true, trim: true },
      en: { type: String, required: true, trim: true },
    },
    // Entered manually by the admin (not derived from `name`) — format and
    // uniqueness are enforced in category.validation.js and here via the
    // unique index (a duplicate is surfaced as a clean 409 by the generic
    // E11000 handling in error.middleware.js).
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

export const Category = model("Category", categorySchema);
