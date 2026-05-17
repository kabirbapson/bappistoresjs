import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const productUploadsDir = path.resolve(__dirname, "../uploads/products");

mkdirSync(productUploadsDir, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/jpg"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png"]);

function isAllowedImage(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  return ALLOWED_MIME.has(file.mimetype) && ALLOWED_EXT.has(ext);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const productImageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedImage(file)) {
      return cb(new Error("Only PNG and JPG images are allowed"));
    }
    cb(null, true);
  },
});
