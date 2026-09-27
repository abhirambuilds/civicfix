import { Router } from 'express';
import {
  createIssueHandler,
  listIssuesHandler,
  getIssueHandler,
  createCommentHandler,
  getCommentsHandler,
} from '../controllers/issue.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../validators/validate.middleware.js';
import {
  createIssueSchema,
  createCommentSchema,
} from '../validators/issue.validator.js';

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
