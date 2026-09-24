import mongoose from "mongoose";

const { Schema, model } = mongoose;

// Public "contact us" submissions — no `user` ref, since the submitter is an
// anonymous site visitor, not necessarily a logged-in account. Compare with
// `requests` (features/requests/), which is the authenticated equivalent for
// a specific server-plan request.
const contactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },

    status: {
      type: String,
      enum: ["pending", "contacted"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

export const Contact = model("Contact", contactSchema);
