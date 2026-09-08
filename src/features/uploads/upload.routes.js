import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../auth/clerk.middleware.js";
import { AppError } from "../../utils/AppError.js";
import { uploadImage } from "./upload.controller.js";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const upload = multer({
  storage: multer.memoryStorage(), // no disk writes — buffer streamed straight to Cloudinary
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
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
  upload.single("image"),
  uploadImage,
);

export default router;
