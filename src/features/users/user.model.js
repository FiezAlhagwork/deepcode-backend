import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    imageUrl: { type: String, default: null },
    role: {
      type: String,
      enum: ["super_admin", "admin", "user"],
      default: "user",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "deactivated"],
      default: "active",
      index: true,
    },
    // Who deactivated this account (null while active). "clerk" = the Clerk
    // account itself was deleted (user.deleted webhook) — a later sign-up with
    // the same email legitimately reactivates it. "admin" = a super_admin
    // removed it via DELETE /api/users/:id — no Clerk event or backfill may
    // ever reactivate it; see user.service.js#upsertUser.
    deactivatedBy: { type: String, enum: ["clerk", "admin"], default: null },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const User = model("User", userSchema);
