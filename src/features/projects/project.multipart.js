import multer from "multer";
import { AppError } from "../../utils/AppError.js";
import { uploadBufferToCloudinary } from "../../utils/cloudinary.js";
import { Project } from "./project.model.js";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const upload = multer({
  storage: multer.memoryStorage(), // no disk writes — buffers streamed straight to Cloudinary
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new AppError("Only JPEG, PNG, WEBP, or GIF images are allowed.", 400, "INVALID_FILE_TYPE"),
      );
    }
    cb(null, true);
  },
});

// Accepts one `coverImage` file and up to 20 `gallery` files in the same
// multipart request as the rest of the project's fields.
export const uploadProjectImages = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "gallery", maxCount: 20 },
]);

const parseJsonField = (value, fieldName) => {
  try {
    return JSON.parse(value);
  } catch {
    throw new AppError(`${fieldName} must be valid JSON.`, 400, "VALIDATION_ERROR");
  }
};

/**
 * Runs after `uploadProjectImages` (multer) and before Zod `validate(...)`.
 * multipart/form-data can't carry nested objects/arrays or real numbers, so:
 * - `name`, `description`, `links` arrive as JSON strings and get parsed here.
 * - `coverImage`/`gallery` arrive as actual files (req.files) and get
 *   uploaded to Cloudinary here, replacing req.body.coverImage/gallery with
 *   plain URL strings/objects — exactly the shape project.validation.js and
 *   project.model.js already expect, so createProject/updateProject/
 *   project.service.js never need to know this request was multipart.
 *
 * Gallery semantics: on POST, `gallery` is just the newly uploaded files
 * (order = attachment order). On PATCH, newly uploaded `gallery` files are
 * APPENDED after whatever is already saved on the project — sending new
 * images never wipes out the existing ones. To remove a specific existing
 * image, use `DELETE /api/projects/:id/gallery/:imageId` instead; there is
 * deliberately no "replace the whole gallery" request shape, since that's
 * exactly the destructive, easy-to-lose-data behavior this replaced.
 *
 * On a PATCH with no new files/fields, the corresponding req.body key is
 * left untouched, so the existing partial-update semantics still apply.
 */
export const normalizeProjectMultipart = async (req, res, next) => {
  try {
    const coverImageFile = req.files?.coverImage?.[0];
    if (coverImageFile) {
      const result = await uploadBufferToCloudinary(coverImageFile.buffer);
      req.body.coverImage = result.secure_url;
    }

    const galleryFiles = req.files?.gallery;
    if (galleryFiles?.length) {
      const uploaded = await Promise.all(
        galleryFiles.map((file) => uploadBufferToCloudinary(file.buffer)),
      );

      // On PATCH (req.params.id present), start numbering after whatever
      // order already exists so appended images sort after current ones.
      let existingGallery = [];
      if (req.params?.id) {
        const existingProject = await Project.findById(req.params.id).select("gallery").lean();
        existingGallery = existingProject?.gallery ?? [];
      }
      const startOrder = existingGallery.reduce((max, item) => Math.max(max, item.order), 0);

      const newItems = uploaded.map((result, index) => ({
        image: result.secure_url,
        publicId: result.public_id,
        order: startOrder + index + 1,
      }));

      req.body.gallery = [...existingGallery, ...newItems];
    }

    if (req.body.name !== undefined) req.body.name = parseJsonField(req.body.name, "name");
    if (req.body.description !== undefined) {
      req.body.description = parseJsonField(req.body.description, "description");
    }
    if (req.body.links !== undefined) req.body.links = parseJsonField(req.body.links, "links");

    next();
  } catch (error) {
    next(error);
  }
};
