import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const brandingUploadsDir = path.resolve(__dirname, "../uploads/branding");

mkdirSync(brandingUploadsDir, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/jpg", "image/webp"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function isAllowedImage(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  return ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, brandingUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    cb(null, `logo-${randomUUID()}${ext}`);
  },
});

export const brandingImageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedImage(file)) {
      return cb(new Error("Only PNG, JPG, or WEBP images are allowed"));
    }
    cb(null, true);
  },
});
