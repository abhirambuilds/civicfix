import { Router } from 'express';
import {
  createIssueHandler,
  listIssuesHandler,
  getIssueHandler,
  createCommentHandler,
  getCommentsHandler,
  updateStatusHandler,
  assignIssueHandler,
  updatePriorityHandler,
  resolveIssueHandler,
  getAssignmentsHandler,
  getStatusHistoryHandler,
  getIssueAiAnalysisHandler,
} from '../controllers/issue.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../validators/validate.middleware.js';
import {
  createIssueSchema,
  createCommentSchema,
  updateStatusSchema,
  assignIssueSchema,
  updatePrioritySchema,
  resolveIssueSchema,
} from '../validators/issue.validator.js';

import {
  uploadImageHandler,
  listImagesHandler,
  getSignedUrlHandler,
  deleteImageHandler,
} from '../controllers/image.controller.js';
import { handleImageUpload } from '../middleware/upload.middleware.js';

const issueRouter = Router();

// All issue endpoints require valid Bearer token authentication
issueRouter.use(requireAuth);

/**
 * POST /api/issues
 * Create/report a new civic issue
 */
issueRouter.post('/', validate(createIssueSchema), createIssueHandler);

/**
 * GET /api/issues
 * List civic issues with role-based scoping, filtering, and pagination
 */
issueRouter.get('/', listIssuesHandler);

/**
 * GET /api/issues/:issueId
 * Retrieve single issue details with verified authorization
 */
issueRouter.get('/:issueId', getIssueHandler);

/**
 * GET /api/issues/:issueId/ai-analysis
 * Retrieve the latest safe AI Issue Intelligence result.
 */
issueRouter.get('/:issueId/ai-analysis', getIssueAiAnalysisHandler);

/**
 * POST /api/issues/:issueId/images
 * Upload an image attachment to an issue (multipart/form-data, field: "image")
 */
issueRouter.post('/:issueId/images', handleImageUpload, uploadImageHandler);

/**
 * GET /api/issues/:issueId/images
 * List all images attached to an issue with signed URLs
 */
issueRouter.get('/:issueId/images', listImagesHandler);

/**
 * GET /api/issues/:issueId/images/:imageId/url
 * Retrieve a fresh short-lived signed URL for an image
 */
issueRouter.get('/:issueId/images/:imageId/url', getSignedUrlHandler);

/**
 * DELETE /api/issues/:issueId/images/:imageId
 * Delete an image attachment and remove its storage object
 */
issueRouter.delete('/:issueId/images/:imageId', deleteImageHandler);

/**
 * PATCH /api/issues/:issueId/status
 * Transition an issue to a new status
 */
issueRouter.patch('/:issueId/status', validate(updateStatusSchema), updateStatusHandler);

/**
 * POST /api/issues/:issueId/assign
 * Assign an issue to a department and optional staff technician
 */
issueRouter.post('/:issueId/assign', validate(assignIssueSchema), assignIssueHandler);

/**
 * PATCH /api/issues/:issueId/priority
 * Update priority for an issue
 */
issueRouter.patch('/:issueId/priority', validate(updatePrioritySchema), updatePriorityHandler);

/**
 * POST /api/issues/:issueId/resolve
 * Mark an issue as resolved with resolution remark
 */
issueRouter.post('/:issueId/resolve', validate(resolveIssueSchema), resolveIssueHandler);

/**
 * GET /api/issues/:issueId/assignments
 * Retrieve assignment history for an issue
 */
issueRouter.get('/:issueId/assignments', getAssignmentsHandler);

/**
 * GET /api/issues/:issueId/status-history
 * Retrieve status transition audit history for an issue
 */
issueRouter.get('/:issueId/status-history', getStatusHistoryHandler);

/**
 * POST /api/issues/:issueId/comments
 * Add a comment to an issue
 */
issueRouter.post('/:issueId/comments', validate(createCommentSchema), createCommentHandler);

/**
 * GET /api/issues/:issueId/comments
 * List comments on an issue (public only for normal USER accounts)
 */
issueRouter.get('/:issueId/comments', getCommentsHandler);

export default issueRouter;
