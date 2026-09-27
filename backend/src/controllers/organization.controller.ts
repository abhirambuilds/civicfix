import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import {
  createOrganization,
  listOrganizations,
  getOrganizationById,
  updateOrganization,
  updateOrganizationStatus,
  listOrganizationMembers,
  addOrganizationMember,
  updateOrganizationMember,
  removeOrganizationMember,
} from '../services/organization.service.js';
import { getOrganizationDashboardData } from '../services/issue.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export async function getOrgDashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const requestedOrgId = (req.params.organizationId || req.query.organizationId) as string | undefined;

    const result = await getOrganizationDashboardData(
      req.user.id,
      req.user.role,
      requestedOrgId
    );

    if (!result.success) {
      sendError(res, result.error || 'Failed to retrieve organization dashboard', result.statusCode || 403);
      return;
    }

    sendSuccess(res, result.data, 'Organization dashboard retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function getOrgDepartments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    if (req.user.role === UserRole.USER) {
      sendError(res, 'Forbidden: Public users cannot view administrative departments.', 403);
      return;
    }

    const requestedOrgId = (req.params.organizationId || req.query.organizationId) as string | undefined;
    const dashboardResult = await getOrganizationDashboardData(
      req.user.id,
      req.user.role,
      requestedOrgId
    );

    if (!dashboardResult.success || !dashboardResult.data) {
      sendError(
        res,
        dashboardResult.error || 'Failed to retrieve organization departments',
        dashboardResult.statusCode || 403
      );
      return;
    }

    sendSuccess(
      res,
      { departments: dashboardResult.data.departments },
      'Departments retrieved successfully',
      200
    );
  } catch (error) {
    next(error);
  }
}

export async function createOrg(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await createOrganization(req.user.role, req.body);
    if (!result.success) {
      sendError(res, result.error || 'Failed to create organization', result.statusCode || 400);
      return;
    }

    sendSuccess(res, result.data, result.message || 'Organization created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function listOrgs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await listOrganizations(req.user.id, req.user.role);
    if (!result.success) {
      sendError(res, result.error || 'Failed to list organizations', result.statusCode || 403);
      return;
    }

    sendSuccess(res, result.data, 'Organizations retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function getOrg(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await getOrganizationById(req.user.id, req.user.role, req.params.organizationId as string);
    if (!result.success) {
      sendError(res, result.error || 'Failed to get organization', result.statusCode || 404);
      return;
    }

    sendSuccess(res, result.data, 'Organization details retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function updateOrg(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await updateOrganization(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.body
    );
    if (!result.success) {
      sendError(res, result.error || 'Failed to update organization', result.statusCode || 400);
      return;
    }

    sendSuccess(res, result.data, result.message || 'Organization updated successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function updateOrgStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await updateOrganizationStatus(
      req.user.role,
      req.params.organizationId as string,
      req.body.isActive
    );
    if (!result.success) {
      sendError(res, result.error || 'Failed to update status', result.statusCode || 400);
      return;
    }

    sendSuccess(res, result.data, result.message || 'Status updated successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function listMembers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await listOrganizationMembers(
      req.user.id,
      req.user.role,
      req.params.organizationId as string
    );
    if (!result.success) {
      sendError(res, result.error || 'Failed to list members', result.statusCode || 403);
      return;
    }

    sendSuccess(res, result.data, 'Members retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function addMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await addOrganizationMember(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.body
    );
    if (!result.success) {
      sendError(res, result.error || 'Failed to add member', result.statusCode || 400);
      return;
    }

    sendSuccess(res, result.data, result.message || 'Member added successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function updateMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await updateOrganizationMember(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.params.userId as string,
      req.body
    );
    if (!result.success) {
      sendError(res, result.error || 'Failed to update member', result.statusCode || 400);
      return;
    }

    sendSuccess(res, result.data, result.message || 'Member updated successfully', 200);
  } catch (error) {
    next(error);
  }
}

export async function removeMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const result = await removeOrganizationMember(
      req.user.id,
      req.user.role,
      req.params.organizationId as string,
      req.params.userId as string
    );
    if (!result.success) {
      sendError(res, result.error || 'Failed to remove member', result.statusCode || 400);
      return;
    }

    sendSuccess(res, null, result.message || 'Member removed successfully', 200);
  } catch (error) {
    next(error);
  }
}
