import mongoose from "mongoose";

const { Schema, model } = mongoose;

const requestSchema = new Schema(
  {
    // Local User `_id`, not the raw Clerk clerkId — stays valid even if the
    // requester's Clerk account is ever deleted and re-created, because
    // upsertUser (user.service.js) re-links the same local doc to the new
    // clerkId instead of creating a disconnected duplicate. See CLAUDE.md.
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Snapshot of the Hardbrain product at request time (not a live
    // reference — that catalog isn't stored locally, and the offer the
    // customer actually saw/requested should stay fixed even if Hardbrain's
    // catalog changes or the product later disappears).
    productId: { type: String, required: true, trim: true, maxlength: 200 },
    productName: { type: String, required: true, trim: true, maxlength: 200 },
    productPrice: { type: Number, required: true, min: 0 },
    productBasePrice: { type: Number, min: 0 },
    billingCycle: { type: String, trim: true, maxlength: 50 },

    requestType: { type: String, enum: ["purchase", "inquiry"], required: true },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    notes: { type: String, trim: true, maxlength: 1000 },

    status: {
      type: String,
      enum: ["pending", "contacted"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

export const Request = model("Request", requestSchema);
