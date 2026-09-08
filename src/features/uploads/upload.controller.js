import { sendSuccess } from "../../utils/apiResponse.js";
import { AppError } from "../../utils/AppError.js";
import { uploadBufferToCloudinary } from "../../utils/cloudinary.js";

export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("No image file was provided.", 400, "NO_FILE");
    }

    const result = await uploadBufferToCloudinary(req.file.buffer);
    return sendSuccess(res, { url: result.secure_url }, "Image uploaded.", 201);
  } catch (error) {
    next(error);
  }
};
