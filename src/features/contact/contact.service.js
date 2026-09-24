import { AppError } from "../../utils/AppError.js";
import { Contact } from "./contact.model.js";

export const createContactMessage = (data) => Contact.create(data);

export const listContactMessages = async ({ page, limit, status }) => {
  const filter = { ...(status && { status }) };

  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Contact.countDocuments(filter),
  ]);
  return { messages, total };
};

export const updateContactStatus = async (id, status) => {
  const message = await Contact.findByIdAndUpdate(id, { status }, { new: true });
  if (!message) throw new AppError("Contact message not found.", 404, "CONTACT_NOT_FOUND");
  return message;
};
