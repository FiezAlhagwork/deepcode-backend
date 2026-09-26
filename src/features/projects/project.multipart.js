import multer from "multer";
import { AppError } from "../../utils/AppError.js";
import {
  uploadBufferToCloudinary,
  destroyCloudinaryAssets,
  ALLOWED_IMAGE_MIME_TYPES,
} from "../../utils/cloudinary.js";

const upload = multer({
  storage: multer.memoryStorage(), // no disk writes — buffers streamed straight to Cloudinary
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
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
 *   uploaded to Cloudinary here, replacing req.body.coverImage (+
 *   coverImagePublicId) / gallery with plain URL strings/objects — exactly
 *   the shape project.validation.js and project.model.js already expect.
 *
 * Gallery semantics: on POST, `gallery` is just the newly uploaded files
 * (order = attachment order). On PATCH, newly uploaded `gallery` files go on
 * `req.newGalleryItems` and are APPENDED (atomic $push in
 * project.service.js#updateProject) after whatever is already saved — sending new
 * images never wipes out the existing ones. To remove a specific existing
 * image, use `DELETE /api/projects/:id/gallery/:imageId` instead; there is
 * deliberately no "replace the whole gallery" request shape, since that's
 * exactly the destructive, easy-to-lose-data behavior this replaced.
 *
 * On a PATCH with no new files/fields, the corresponding req.body key is
 * left untouched, so the existing partial-update semantics still apply.
 *
 * Content-Type is enforced strictly as multipart/form-data (not just
 * expected by convention): a plain `application/json` request would already
 * have had its body parsed into real objects/arrays by express.json() in
 * app.js before it ever reaches here, letting a client set `req.body.gallery`
 * directly — including a `publicId` of its own choosing, which
 * removeGalleryImage() later trusts blindly when calling
 * `cloudinary.uploader.destroy(...)`. Rejecting non-multipart requests here
 * closes that off at the one chokepoint both POST and PATCH share, and
 * `req.body.gallery` is additionally reset before every request so it can
 * only ever be repopulated from this function's own upload logic below,
 * never from a raw client-supplied field of any kind.
 */
export const normalizeProjectMultipart = async (req, res, next) => {
  // Every asset uploaded by this request, so cleanupProjectUploads (below)
  // can delete them if anything later in the chain fails — Zod validation,
  // a missing category, a duplicate slug, etc.
  req.uploadedPublicIds = [];

  try {
    if (!req.is("multipart/form-data")) {
      throw new AppError("Expected multipart/form-data.", 400, "INVALID_CONTENT_TYPE");
    }

    // Both carry Cloudinary public_ids that are later passed to
    // cloudinary.uploader.destroy(), so they may only ever be set from this
    // function's own upload results, never from a client-supplied field.
    delete req.body.gallery;
    delete req.body.coverImagePublicId;

    const coverImageFile = req.files?.coverImage?.[0];
    const galleryFiles = req.files?.gallery ?? [];

    // allSettled, not all: if one upload fails, the ones that succeeded
    // still get recorded for cleanup instead of being orphaned.
    const results = await Promise.allSettled(
      [coverImageFile, ...galleryFiles]
        .filter(Boolean)
        .map((file) => uploadBufferToCloudinary(file.buffer)),
    );
    for (const result of results) {
      if (result.status === "fulfilled") req.uploadedPublicIds.push(result.value.public_id);
    }
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;

    const uploaded = results.map((result) => result.value);

    if (coverImageFile) {
      const cover = uploaded.shift();
      req.body.coverImage = cover.secure_url;
      req.body.coverImagePublicId = cover.public_id;
    }

    if (uploaded.length) {
      const newItems = uploaded.map((result) => ({
        image: result.secure_url,
        publicId: result.public_id,
      }));

      if (req.params?.id) {
        // PATCH: kept off req.body entirely — project.service.js#updateProject
        // appends these with an atomic $push rather than rewriting the whole
        // array, so a concurrent PATCH or gallery-image DELETE is never lost
        // or undone.
        req.newGalleryItems = newItems;
      } else {
        req.body.gallery = newItems.map((item, index) => ({ ...item, order: index + 1 }));
      }
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

// Router-level error middleware (mounted last in project.routes.js): if a
// POST/PATCH fails anywhere after its images were already uploaded, delete
// them from Cloudinary before handing the error on to the central handler,
// so a rejected request never leaves orphaned assets behind.
export const cleanupProjectUploads = async (err, req, res, next) => {
  if (req.uploadedPublicIds?.length) {
    await destroyCloudinaryAssets(req.uploadedPublicIds);
  }
  next(err);
};
