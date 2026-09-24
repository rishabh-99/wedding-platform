import multer from 'multer';
import { EXTENSION_MIME, UPLOAD_LIMITS, fileExtension } from '@wedding/shared';
import { unsupported } from '../lib/errors';

/**
 * Multer front-line: memory storage with hard byte limits and an extension
 * allow-list. Deep validation (magic bytes, dimensions, duration) happens in
 * mediaService.validateFile.
 */
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!EXTENSION_MIME[fileExtension(file.originalname)]) {
    cb(unsupported(`“${file.originalname}” is not a supported file type`));
    return;
  }
  cb(null, true);
};

export const adminUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_LIMITS.videoMaxBytes,
    files: UPLOAD_LIMITS.maxFilesPerRequest,
    fields: 20,
    fieldSize: 64 * 1024,
  },
  fileFilter,
});

export const guestUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.guestImageMaxBytes, files: 1, fields: 10, fieldSize: 8 * 1024 },
  fileFilter,
});
