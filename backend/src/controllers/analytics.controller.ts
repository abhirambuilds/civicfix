import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { analyticsQuerySchema } from '../validators/analytics.validator.js';
import { getOrganizationAnalytics } from '../services/analytics.service.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

export async function getOrgAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message || 'Invalid analytics filters.', 400);
      return;
    }

    const result = await getOrganizationAnalytics(req.user.id, req.user.role as UserRole, parsed.data);
    if (!result.success) {
      sendError(res, result.error || 'Failed to retrieve organization analytics.', result.statusCode || 403);
      return;
    }

    sendSuccess(res, result.data, 'Organization analytics retrieved successfully.', 200);
  } catch (error) {
    next(error);
  }
}
