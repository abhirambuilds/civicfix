// ==============================================================================
// CivicFix - Image Security & Validation Utilities
// Magic-byte signature verification, filename sanitization, and path traversal guards.
// ==============================================================================

import path from 'path';
import crypto from 'crypto';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMAGES_PER_ISSUE = 5;

/**
 * Checks whether the buffer matches known image magic byte signatures.
 * Protects against MIME-spoofing attacks (e.g. executable disguised as image/jpeg).
 */
export function validateImageMagicBytes(
  buffer: Buffer,
  declaredMime: string
): { valid: boolean; detectedMime?: string; error?: string } {
  if (!buffer || buffer.length < 12) {
    return {
      valid: false,
      error: 'File content is too small to be a valid image.',
    };
  }

  // 1. JPEG signature: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) {
    if (declaredMime === 'image/jpeg' || declaredMime === 'image/jpg') {
      return { valid: true, detectedMime: 'image/jpeg' };
    }
    return {
      valid: false,
      error: `File signature is JPEG but declared as ${declaredMime}.`,
    };
  }

  // 2. PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (isPng) {
    if (declaredMime === 'image/png') {
      return { valid: true, detectedMime: 'image/png' };
    }
    return {
      valid: false,
      error: `File signature is PNG but declared as ${declaredMime}.`,
    };
  }

  // 3. WebP signature: RIFF .... WEBP
  const isRiff =
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46; // F

  const isWebp =
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50; // P

  if (isRiff && isWebp) {
    if (declaredMime === 'image/webp') {
      return { valid: true, detectedMime: 'image/webp' };
    }
    return {
      valid: false,
      error: `File signature is WebP but declared as ${declaredMime}.`,
    };
  }

  return {
    valid: false,
    error: `Unsupported or invalid image file signature. Declared: ${declaredMime}.`,
  };
}

/**
 * Sanitizes a client-provided filename:
 * - Strips directory traversal sequences (../, ..\, /, \)
 * - Replaces non-alphanumeric chars (excluding dots, dashes, underscores)
 * - Limits base length to 60 characters
 */
export function sanitizeFilename(originalName: string): string {
  const baseName = path.basename(originalName);
  // Remove dangerous control characters and traversal markers
  const clean = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Truncate to reasonable length
  return clean.slice(0, 60) || 'image.jpg';
}

/**
 * Generates an collision-free, safe storage path for Supabase Storage:
 * Format: issues/{issueId}/{uuid}-{sanitizedFilename}
 */
export function generateSafeStoragePath(
  issueId: string,
  originalFilename: string,
  mimeType: string
): string {
  const randomId = crypto.randomUUID();
  const safeName = sanitizeFilename(originalFilename);

  // Ensure extension matches MIME type
  let ext = path.extname(safeName).toLowerCase();
  if (!ext || ext === '.') {
    if (mimeType === 'image/jpeg') ext = '.jpg';
    else if (mimeType === 'image/png') ext = '.png';
    else if (mimeType === 'image/webp') ext = '.webp';
    else ext = '.img';
  }

  const nameWithoutExt = path.basename(safeName, ext).slice(0, 40) || 'photo';
  return `issues/${issueId}/${randomId}-${nameWithoutExt}${ext}`;
}
