import { v2 as cloudinary } from "cloudinary";
import { fileTypeFromBuffer } from "file-type";
import { env } from "../config/env.js";
import { AppError } from "./AppError.js";

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
  timeout: 120000,
});

// Single source of truth for which image types this app accepts — used both
// by multer's `fileFilter` (checks the client-supplied Content-Type, which
// is spoofable) and by `uploadBufferToCloudinary` below (checks the file's
// actual bytes, which isn't) — currently `uploads` and `projects`.
export const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Shared by any feature that needs to upload an in-memory image buffer
// (multer memoryStorage) to Cloudinary — currently `uploads` and `projects`.
// Re-validates the buffer's actual content (magic bytes) against
// ALLOWED_IMAGE_MIME_TYPES before uploading — multer's `fileFilter` only
// trusts the client-supplied `Content-Type` header, which a caller can set
// to anything regardless of what the file's bytes actually are.
export const uploadBufferToCloudinary = async (buffer, options = {}) => {
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_IMAGE_MIME_TYPES.has(detected.mime)) {
    throw new AppError(
      "The uploaded file's content does not match an allowed image type (JPEG, PNG, WEBP, or GIF).",
      400,
      "INVALID_FILE_TYPE",
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "projects", resource_type: "image", ...options },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });
};

export { cloudinary };
