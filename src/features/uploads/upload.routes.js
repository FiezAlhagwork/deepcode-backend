import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../auth/clerk.middleware.js";
import { writeRateLimit } from "../../middlewares/writeRateLimit.middleware.js";
import { AppError } from "../../utils/AppError.js";
import { ALLOWED_IMAGE_MIME_TYPES } from "../../utils/cloudinary.js";
import { uploadImage } from "./upload.controller.js";

const upload = multer({
  storage: multer.memoryStorage(), // no disk writes — buffer streamed straight to Cloudinary
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    // Cheap, early rejection on the client-supplied Content-Type; the file's
    // actual bytes are re-checked in uploadBufferToCloudinary() once the
    // buffer is available, since this header alone is spoofable.
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new AppError("Only JPEG, PNG, WEBP, or GIF images are allowed.", 400, "INVALID_FILE_TYPE"),
      );
    }
    cb(null, true);
  },
});

const router = Router();

router.post(
  "/",
  requireAuth,
  requireRole("admin", "super_admin"),
  writeRateLimit,
  upload.single("image"),
  uploadImage,
);

export default router;
