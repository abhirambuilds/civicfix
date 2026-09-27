import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  requireRole,
  requireAnyRole,
  requireOrganizationAccess,
  requireDepartmentAccess,
  requireUserOwnership,
  requireIssueAccess,
} from '../middleware/rbac.middleware.js';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * RBAC Development & Testing Routes
 * NOTE: These routes exist specifically to test and verify the authorization layer.
 * They do not expose sensitive data and are mounted strictly for development and testing.
 */
const rbacTestRouter = Router();

// 1. Platform Superadmin endpoint
rbacTestRouter.get(
  '/platform',
  requireAuth,
  requireRole(UserRole.PLATFORM_ADMIN),
  (req: Request, res: Response) => {
    sendSuccess(res, { role: req.user?.role }, 'Platform admin endpoint accessed successfully');
  }
);

// 2. Organization Admin / Owner endpoint
rbacTestRouter.get(
  '/admin',
  requireAuth,
  requireAnyRole(UserRole.ORG_OWNER, UserRole.ORG_ADMIN),
  (req: Request, res: Response) => {
    sendSuccess(res, { role: req.user?.role }, 'Organization admin endpoint accessed successfully');
  }
);

// 3. Department Manager endpoint
rbacTestRouter.get(
  '/manager',
  requireAuth,
  requireRole(UserRole.MANAGER),
  (req: Request, res: Response) => {
    sendSuccess(res, { role: req.user?.role }, 'Department manager endpoint accessed successfully');
  }
);

// 4. Staff / Field Technician operational endpoint
rbacTestRouter.get(
  '/staff',
  requireAuth,
  requireAnyRole(UserRole.STAFF, UserRole.MANAGER, UserRole.ORG_ADMIN, UserRole.ORG_OWNER),
  (req: Request, res: Response) => {
    sendSuccess(res, { role: req.user?.role }, 'Staff operational endpoint accessed successfully');
  }
);

// 5. Citizen / Student User endpoint
rbacTestRouter.get(
  '/user',
  requireAuth,
  requireRole(UserRole.USER),
  (req: Request, res: Response) => {
    sendSuccess(res, { role: req.user?.role }, 'Citizen user endpoint accessed successfully');
  }
);

// 6. Organization-scoped access endpoint
rbacTestRouter.get(
  '/organizations/:organizationId',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  (req: Request, res: Response) => {
    sendSuccess(
      res,
      {
        organizationId: req.params.organizationId,
        orgMembership: req.orgMembership,
      },
      'Organization resource accessed successfully'
    );
  }
);

// 7. Department-scoped access endpoint
rbacTestRouter.get(
  '/departments/:departmentId',
  requireAuth,
  requireDepartmentAccess('departmentId'),
  (req: Request, res: Response) => {
    sendSuccess(
      res,
      {
        departmentId: req.params.departmentId,
        deptMembership: req.deptMembership,
      },
      'Department resource accessed successfully'
    );
  }
);

// 8. User-scoped resource ownership endpoint
rbacTestRouter.get(
  '/users/:userId/data',
  requireAuth,
  requireUserOwnership('userId'),
  (req: Request, res: Response) => {
    sendSuccess(
      res,
      {
        userId: req.params.userId,
      },
      'User own-data accessed successfully'
    );
  }
);

// 9. Issue-scoped access endpoint
rbacTestRouter.get(
  '/issues/:issueId',
  requireAuth,
  requireIssueAccess('issueId'),
  (req: Request, res: Response) => {
    sendSuccess(
      res,
      {
        issueId: req.params.issueId,
      },
      'Issue resource accessed successfully'
    );
  }
);

// 10. Role tampering test endpoint (POST)
rbacTestRouter.post(
  '/admin-action',
  requireAuth,
  requireRole(UserRole.PLATFORM_ADMIN),
  (req: Request, res: Response) => {
    sendSuccess(res, { role: req.user?.role }, 'Admin action executed');
  }
);

export default rbacTestRouter;
