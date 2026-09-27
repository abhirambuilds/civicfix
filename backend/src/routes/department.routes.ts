import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireOrganizationAccess } from '../middleware/rbac.middleware.js';
import { validate } from '../validators/validate.middleware.js';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  updateDeptStatusSchema,
  addDeptMemberSchema,
  updateDeptMemberSchema,
} from '../validators/department.validator.js';
import {
  createDept,
  listDepts,
  getDept,
  updateDept,
  updateDeptStatus,
  listDeptMembers,
  addDeptMember,
  updateDeptMember,
  removeDeptMember,
} from '../controllers/department.controller.js';

const departmentRouter = Router({ mergeParams: true });

// ==============================================================================
// Department CRUD Endpoints
// Base Path: /api/organizations/:organizationId/departments
// ==============================================================================

// 1. Create Department
departmentRouter.post(
  '/',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  validate(createDepartmentSchema),
  createDept
);

// 2. List Departments
departmentRouter.get(
  '/',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  listDepts
);

// 3. Get Department Details
departmentRouter.get(
  '/:departmentId',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  getDept
);

// 4. Update Department Metadata
departmentRouter.patch(
  '/:departmentId',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  validate(updateDepartmentSchema),
  updateDept
);

// 5. Activate / Deactivate Department
departmentRouter.patch(
  '/:departmentId/status',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  validate(updateDeptStatusSchema),
  updateDeptStatus
);

// ==============================================================================
// Department Members Endpoints
// Base Path: /api/organizations/:organizationId/departments/:departmentId/members
// ==============================================================================

// 6. List Department Members
departmentRouter.get(
  '/:departmentId/members',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  listDeptMembers
);

// 7. Add Department Member
departmentRouter.post(
  '/:departmentId/members',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  validate(addDeptMemberSchema),
  addDeptMember
);

// 8. Update Department Member Role / Status
departmentRouter.patch(
  '/:departmentId/members/:userId',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  validate(updateDeptMemberSchema),
  updateDeptMember
);

// 9. Remove / Deactivate Department Member
departmentRouter.delete(
  '/:departmentId/members/:userId',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  removeDeptMember
);

export default departmentRouter;
