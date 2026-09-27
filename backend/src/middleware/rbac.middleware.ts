import { Request, Response, NextFunction } from 'express';
import {
  UserRole,
  OrganizationAccessOptions,
  DepartmentAccessOptions,
  UserOwnershipOptions,
} from '../types/rbac.types.js';
import {
  getUserActiveRecord,
  canAccessOrganization,
  canAccessDepartment,
  canAccessIssue,
} from '../services/rbac.service.js';
import { sendError } from '../utils/apiResponse.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Reusable role-checking middleware.
 * Verifies that the authenticated user has at least one of the specified roles.
 * Authoritative: Validates active database status and current role, preventing stale JWT roles.
 * Never trusts req.body.role or query.role.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. Must be authenticated
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    try {
      // 2. Refresh active status and role from database
      const dbUser = await getUserActiveRecord(req.user.id);
      if (!dbUser || !dbUser.isActive) {
        sendError(res, 'Account is deactivated or does not exist.', 401);
        return;
      }

      // Update in-memory req.user with authoritative database role
      req.user.role = dbUser.role;

      // 3. Verify user has one of the required roles
      if (!allowedRoles.includes(req.user.role)) {
        sendError(
          res,
          `Forbidden: Insufficient permissions. Required role: ${allowedRoles.join(' or ')}.`,
          403
        );
        return;
      }

      next();
    } catch {
      sendError(res, 'Internal authorization error.', 500);
    }
  };
}

/**
 * Convenience alias for requireRole.
 */
export const requireAnyRole = requireRole;

/**
 * Middleware ensuring the authenticated user has access to a specific organization.
 * Validates organizationId parameter and verifies active membership from database.
 */
export function requireOrganizationAccess(
  paramName = 'organizationId',
  options?: OrganizationAccessOptions
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const orgId = (req.params[paramName] || req.query[paramName]) as string | undefined;

    if (!orgId || !isValidUuid(orgId)) {
      sendError(res, 'Invalid or missing organization ID parameter.', 400);
      return;
    }

    try {
      // Refresh current role from database
      const dbUser = await getUserActiveRecord(req.user.id);
      if (!dbUser || !dbUser.isActive) {
        sendError(res, 'Account is deactivated or does not exist.', 401);
        return;
      }
      req.user.role = dbUser.role;

      // Check organization access
      const result = await canAccessOrganization(
        req.user.id,
        req.user.role,
        orgId,
        options
      );

      if (!result.allowed) {
        sendError(res, result.reason || 'Forbidden: Access to this organization is denied.', 403);
        return;
      }

      if (result.membership) {
        req.orgMembership = result.membership as any;
      }

      next();
    } catch {
      sendError(res, 'Internal authorization error.', 500);
    }
  };
}

/**
 * Middleware ensuring the authenticated user has access to a specific department.
 * Validates departmentId parameter and checks department membership from database.
 */
export function requireDepartmentAccess(
  paramName = 'departmentId',
  options?: DepartmentAccessOptions
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const deptId = (req.params[paramName] || req.query[paramName]) as string | undefined;

    if (!deptId || !isValidUuid(deptId)) {
      sendError(res, 'Invalid or missing department ID parameter.', 400);
      return;
    }

    try {
      const dbUser = await getUserActiveRecord(req.user.id);
      if (!dbUser || !dbUser.isActive) {
        sendError(res, 'Account is deactivated or does not exist.', 401);
        return;
      }
      req.user.role = dbUser.role;

      const result = await canAccessDepartment(
        req.user.id,
        req.user.role,
        deptId,
        options
      );

      if (result.notFound) {
        sendError(res, 'Department not found or is inactive.', 404);
        return;
      }

      if (!result.allowed) {
        sendError(res, result.reason || 'Forbidden: Access to this department is denied.', 403);
        return;
      }

      if (result.membership) {
        req.deptMembership = result.membership as any;
      }

      next();
    } catch {
      sendError(res, 'Internal authorization error.', 500);
    }
  };
}

/**
 * Middleware enforcing user-scoped data isolation.
 * Prevents horizontal privilege escalation where User A accesses User B's resources.
 * Identity comes strictly from verified JWT/database, never from request body.
 */
export function requireUserOwnership(
  paramName = 'userId',
  options?: UserOwnershipOptions
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const targetUserId = (req.params[paramName] || req.query[paramName]) as string | undefined;

    if (!targetUserId || !isValidUuid(targetUserId)) {
      sendError(res, 'Invalid or missing user ID parameter.', 400);
      return;
    }

    try {
      const dbUser = await getUserActiveRecord(req.user.id);
      if (!dbUser || !dbUser.isActive) {
        sendError(res, 'Account is deactivated or does not exist.', 401);
        return;
      }
      req.user.role = dbUser.role;

      // Platform admin override if explicitly permitted
      if (options?.allowPlatformAdmin && req.user.role === UserRole.PLATFORM_ADMIN) {
        next();
        return;
      }

      // Strict user identity check
      if (req.user.id !== targetUserId) {
        sendError(res, 'Forbidden: You cannot access another user\'s resources.', 403);
        return;
      }

      next();
    } catch {
      sendError(res, 'Internal authorization error.', 500);
    }
  };
}

/**
 * Middleware enforcing issue access rights based on user role and assignment.
 */
export function requireIssueAccess(paramName = 'issueId') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.user.id) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const issueId = (req.params[paramName] || req.query[paramName]) as string | undefined;

    if (!issueId || !isValidUuid(issueId)) {
      sendError(res, 'Invalid or missing issue ID parameter.', 400);
      return;
    }

    try {
      const dbUser = await getUserActiveRecord(req.user.id);
      if (!dbUser || !dbUser.isActive) {
        sendError(res, 'Account is deactivated or does not exist.', 401);
        return;
      }
      req.user.role = dbUser.role;

      const result = await canAccessIssue(req.user.id, req.user.role, issueId);

      if (result.notFound) {
        sendError(res, 'Issue not found.', 404);
        return;
      }

      if (!result.allowed) {
        sendError(res, result.reason || 'Forbidden: Access to this issue is denied.', 403);
        return;
      }

      next();
    } catch {
      sendError(res, 'Internal authorization error.', 500);
    }
  };
}
