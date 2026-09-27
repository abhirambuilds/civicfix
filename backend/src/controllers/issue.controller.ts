import { Request, Response } from 'express';
import {
  createIssue,
  getIssueById,
  listIssues,
  createIssueComment,
  getIssueComments,
  listIssueCategories,
  updateIssueStatus,
  assignIssue,
  updateIssuePriority,
  resolveIssue,
  getIssueAssignments,
  getIssueStatusHistory,
} from '../services/issue.service.js';
import { getIssueIntelligenceForIssue } from '../services/issue-intelligence.service.js';
import { getSmartRoutingForIssue } from '../services/smart-routing.service.js';
import { getDuplicateDetectionForIssue } from '../services/duplicate-detection.service.js';
import { getImageVerificationForIssue } from '../services/image-verification.service.js';
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
 * GET /api/issues/:issueId/ai-analysis
 * Return the latest safe Issue Intelligence result for an authorized viewer.
 */
export async function getIssueAiAnalysisHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const result = await getIssueIntelligenceForIssue(
    req.user.id,
    req.user.role,
    req.params.issueId as string,
  );
  if (!result.success) {
    sendError(res, result.error, result.statusCode);
    return;
  }

  sendSuccess(res, result.data, 'AI issue analysis retrieved successfully', 200);
}

/**
 * GET /api/issues/:issueId/ai-routing
 * Return the latest validated Smart Routing recommendation for an authorized viewer.
 */
export async function getIssueAiRoutingHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const result = await getSmartRoutingForIssue(
    req.user.id,
    req.user.role,
    req.params.issueId as string,
  );
  if (!result.success) {
    sendError(res, result.error, result.statusCode);
    return;
  }

  sendSuccess(res, result.data, 'AI smart routing retrieved successfully', 200);
}

/**
 * GET /api/issues/:issueId/duplicate-analysis
 * Return the latest safe advisory duplicate assessment for an authorized viewer.
 */
export async function getIssueDuplicateAnalysisHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const result = await getDuplicateDetectionForIssue(
    req.user.id,
    req.user.role,
    req.params.issueId as string,
  );
  if (!result.success) {
    sendError(res, result.error, result.statusCode);
    return;
  }

  sendSuccess(res, result.data, 'Duplicate analysis retrieved successfully', 200);
}

/**
 * GET /api/issues/:issueId/image-verification
 * Return the latest advisory image verification result for an authorized viewer.
 */
export async function getIssueImageVerificationHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) { sendError(res, 'Authentication required.', 401); return; }
  const result = await getImageVerificationForIssue(req.user.id, req.user.role, req.params.issueId as string);
  if (!result.success) { sendError(res, result.error, result.statusCode); return; }
  sendSuccess(res, result.data, 'AI image verification retrieved successfully', 200);
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

/**
 * PATCH /api/issues/:issueId/status
 * Transition an issue to a new status.
 */
export async function updateStatusHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const result = await updateIssueStatus(req.user.id, req.user.role, issueId, req.body);
  if (!result.success) {
    sendError(res, result.error || 'Failed to update status.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Issue status updated successfully', 200);
}

/**
 * POST /api/issues/:issueId/assign
 * Assign an issue to a department and optional staff technician.
 */
export async function assignIssueHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const result = await assignIssue(req.user.id, req.user.role, issueId, req.body);
  if (!result.success) {
    sendError(res, result.error || 'Failed to assign issue.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Issue assigned successfully', 201);
}

/**
 * PATCH /api/issues/:issueId/priority
 * Update priority for an issue.
 */
export async function updatePriorityHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const result = await updateIssuePriority(req.user.id, req.user.role, issueId, req.body);
  if (!result.success) {
    sendError(res, result.error || 'Failed to update priority.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Issue priority updated successfully', 200);
}

/**
 * POST /api/issues/:issueId/resolve
 * Mark an issue as resolved with resolution remark.
 */
export async function resolveIssueHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const result = await resolveIssue(req.user.id, req.user.role, issueId, req.body);
  if (!result.success) {
    sendError(res, result.error || 'Failed to resolve issue.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Issue resolved successfully', 200);
}

/**
 * GET /api/issues/:issueId/assignments
 * Retrieve assignment history for an issue.
 */
export async function getAssignmentsHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const result = await getIssueAssignments(req.user.id, req.user.role, issueId);
  if (!result.success) {
    sendError(res, result.error || 'Failed to retrieve assignments.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Issue assignments retrieved successfully', 200);
}

/**
 * GET /api/issues/:issueId/status-history
 * Retrieve status transition audit history for an issue.
 */
export async function getStatusHistoryHandler(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.user.id) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const issueId = req.params.issueId as string;
  const result = await getIssueStatusHistory(req.user.id, req.user.role, issueId);
  if (!result.success) {
    sendError(res, result.error || 'Failed to retrieve status history.', result.statusCode || 400);
    return;
  }

  sendSuccess(res, result.data, 'Issue status history retrieved successfully', 200);
}
