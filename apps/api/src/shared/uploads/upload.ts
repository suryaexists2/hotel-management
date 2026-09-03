import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Root of the id-proof upload storage. The Electron main process points this at a
 * stable, writable location (userData/uploads). In plain dev API runs we fall back
 * to the repo-relative uploads directory.
 */
export const uploadsDir = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../../uploads');

/** Create the id-proofs subdirectory if missing (multer does not create it). */
export function ensureUploadsDir(): string {
  const dir = path.join(uploadsDir, 'id-proofs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadsDir());
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `proof-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, GIF and PDF files are allowed'));
  }
};

export const uploadIdProof = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function getUploadUrl(filename: string): string {
  return `/uploads/id-proofs/${filename}`;
}
