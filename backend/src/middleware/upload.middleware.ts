// ==============================================================================
// CivicFix - Multipart Image Upload Middleware
// Uses Multer memoryStorage with 5 MB file size limit and structured error responses.
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from '../utils/imageValidation.js';
import { sendError } from '../utils/apiResponse.js';

// Memory storage keeps file buffer in memory for magic-byte validation and direct Supabase streaming
const storage = multer.memoryStorage();

const multerUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 5 MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Preliminary client MIME check (magic bytes validated subsequently)
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      cb(new Error(`Invalid image type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`));
      return;
    }
    cb(null, true);
  },
}).single('image');

/**
 * Middleware handling multipart/form-data for issue image uploads.
 * Rejects oversized files with HTTP 413 and invalid MIME with HTTP 400.
 */
export function handleImageUpload(req: Request, res: Response, next: NextFunction): void {
  multerUpload(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          sendError(res, 'File too large. Maximum image size is 5 MB.', 413);
          return;
        }
        sendError(res, `Upload error: ${err.message}`, 400);
        return;
      }

      sendError(res, err.message || 'File upload validation failed.', 400);
      return;
    }

    next();
  });
}
