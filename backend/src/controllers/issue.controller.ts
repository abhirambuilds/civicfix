import { Request, Response } from 'express';
import {
  createIssue,
  getIssueById,
  listIssues,
  createIssueComment,
  getIssueComments,
  listIssueCategories,
} from '../services/issue.service.js';
import { issueQuerySchema } from '../validators/issue.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * POST /api/issues
 * Report/create a new civic issue.
 */
export async function createIssueHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const result = await createIssue(req.user.id, req.user.role, req.body);
  if (!result.success) {
    sendError(res, result.error || 'Failed to create issue.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Issue reported successfully', 201);
}

/**
 * GET /api/issues
 * List issues with role-based scoping, filtering, and pagination.
 */
export async function listIssuesHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const parsedQuery = issueQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    const firstIssue = parsedQuery.error.issues[0];
    sendError(res, firstIssue ? firstIssue.message : 'Invalid query parameters.', 400);
    return;
  }

  const result = await listIssues(req.user.id, req.user.role, parsedQuery.data);
  if (!result.success) {
    sendError(res, result.error || 'Failed to list issues.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Issues retrieved successfully', 200);
}

/**
 * GET /api/issues/:issueId
 * Retrieve detailed information for a single issue.
 */
export async function getIssueHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const result = await getIssueById(req.user.id, req.user.role, issueId);
  if (!result.success) {
    sendError(res, result.error || 'Failed to retrieve issue.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Issue retrieved successfully', 200);
}

/**
 * POST /api/issues/:issueId/comments
 * Add a comment or remark to an issue.
 */
export async function createCommentHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const result = await createIssueComment(req.user.id, req.user.role, issueId, req.body);
  if (!result.success) {
    sendError(res, result.error || 'Failed to add comment.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Comment added successfully', 201);
}

/**
 * GET /api/issues/:issueId/comments
 * Retrieve comments for an issue.
 */
export async function getCommentsHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const result = await getIssueComments(req.user.id, req.user.role, issueId);
  if (!result.success) {
    sendError(res, result.error || 'Failed to retrieve comments.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Comments retrieved successfully', 200);
}

/**
 * GET /api/issue-categories
 * List active issue categories.
 */
export async function listCategoriesHandler(req: Request, res: Response): Promise<void> {
  const organizationId = req.query.organizationId as string | undefined;
  const result = await listIssueCategories(organizationId);
  if (!result.success) {
    sendError(res, result.error || 'Failed to retrieve categories.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Categories retrieved successfully', 200);
}
