// ==============================================================================
// CivicFix - Issue Image Controller
// Handlers for image upload, listing, signed URL generation, and deletion.
// ==============================================================================

import { Request, Response } from 'express';
import {
  uploadIssueImage,
  listIssueImages,
  getSignedImageUrl,
  deleteIssueImage,
} from '../services/image.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * POST /api/issues/:issueId/images
 * Upload an image attachment to an issue (multipart/form-data, field: "image").
 */
export async function uploadImageHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const isPrimary = req.body?.isPrimary === 'true' || req.body?.isPrimary === true;

  const result = await uploadIssueImage(
    req.user.id,
    req.user.role,
    issueId,
    req.file,
    isPrimary
  );

  if (!result.success) {
    sendError(res, result.error || 'Failed to upload image.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, result.message || 'Image uploaded successfully.', 201);
}

/**
 * GET /api/issues/:issueId/images
 * List all images attached to an issue with signed URLs.
 */
export async function listImagesHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const result = await listIssueImages(req.user.id, req.user.role, issueId);

  if (!result.success) {
    sendError(res, result.error || 'Failed to retrieve images.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Images retrieved successfully.', 200);
}

/**
 * GET /api/issues/:issueId/images/:imageId/url
 * Retrieve a fresh short-lived signed URL for a specific image.
 */
export async function getSignedUrlHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const imageId = req.params.imageId as string;

  const result = await getSignedImageUrl(req.user.id, req.user.role, issueId, imageId);

  if (!result.success) {
    sendError(res, result.error || 'Failed to generate signed URL.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Signed URL generated successfully.', 200);
}

/**
 * DELETE /api/issues/:issueId/images/:imageId
 * Delete an image attachment and remove its object from storage.
 */
export async function deleteImageHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const imageId = req.params.imageId as string;

  const result = await deleteIssueImage(req.user.id, req.user.role, issueId, imageId);

  if (!result.success) {
    sendError(res, result.error || 'Failed to delete image.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, null, result.message || 'Image deleted successfully.', 200);
}
