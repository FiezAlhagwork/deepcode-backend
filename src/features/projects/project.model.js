import mongoose from "mongoose";

const { Schema, model } = mongoose;

const gallerySchema = new Schema({
  image: { type: String, required: true },
  // Cloudinary's own asset id (result.public_id) — kept so a single gallery
  // image can later be deleted from Cloudinary itself, not just removed
  // from this array. Optional so records created before this field existed
  // don't fail validation.
  publicId: { type: String },
  order: { type: Number, required: true },
});
// Each gallery item keeps its own `_id` (Mongoose's default) so a single
// image can be addressed/removed individually via
// DELETE /api/projects/:id/gallery/:imageId — unlike `links` below, which
// never needs to be addressed item-by-item.

const linkSchema = new Schema(
  {
    // NOTE: this subdocument field is literally named `type`, which collides
    // with Mongoose's own `{ type: ... }` schema-definition syntax. The
    // nested form below (`type: { type: String, required: true }`) is the
    // correct, intentional way to declare a field named "type" — do NOT
    // "simplify" this to `type: String`, that would make Mongoose interpret
    // the whole subdocument's type as the String constructor instead of an
    // object shape with a `type`/`url` pair.
    type: { type: String, required: true }, // free-form, e.g. "preview" | "github" | "store" | ...
    url: { type: String, required: true },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    name: {
      ar: { type: String, required: true, trim: true },
      en: { type: String, required: true, trim: true },
    },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: {
      ar: { type: String, required: true },
      en: { type: String, required: true },
    },
    coverImage: { type: String, required: true },
    // Cloudinary public_id of coverImage — lets a replaced cover or a deleted
    // project clean up its asset. Optional: older records predate this field.
    coverImagePublicId: { type: String },
    gallery: { type: [gallerySchema], default: [] },
    links: { type: [linkSchema], default: [] },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Matches the public list query (status filter + order/createdAt sort) and
// the category filter / CATEGORY_IN_USE check.
projectSchema.index({ status: 1, order: 1, createdAt: -1 });
projectSchema.index({ category: 1 });

export const Project = model("Project", projectSchema);
