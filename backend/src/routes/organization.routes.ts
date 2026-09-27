import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole, requireOrganizationAccess } from '../middleware/rbac.middleware.js';
import { validate } from '../validators/validate.middleware.js';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  updateOrgStatusSchema,
  addMemberSchema,
  updateMemberSchema,
} from '../validators/organization.validator.js';
import {
  createOrg,
  listOrgs,
  getOrg,
  getOrgDashboard,
  updateOrg,
  updateOrgStatus,
  listMembers,
  addMember,
  updateMember,
  removeMember,
} from '../controllers/organization.controller.js';
import departmentRouter from './department.routes.js';

const organizationRouter = Router();

// ==============================================================================
// Organization CRUD Endpoints
// ==============================================================================

// 1. Create Organization (Platform Superadmin Only)
organizationRouter.post(
  '/',
  requireAuth,
  requireRole(UserRole.PLATFORM_ADMIN),
  validate(createOrganizationSchema),
  createOrg
);

// 2. List Organizations (Scoped based on role)
organizationRouter.get(
  '/',
  requireAuth,
  listOrgs
);

// 2b. Organization Dashboard Summary (Derived from Authenticated User Context)
organizationRouter.get(
  '/me/dashboard',
  requireAuth,
  getOrgDashboard
);

// 2c. Organization Dashboard Summary by ID (Authorized Organization Member)
organizationRouter.get(
  '/:organizationId/dashboard',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  getOrgDashboard
);

// 3. Get Organization Details
organizationRouter.get(
  '/:organizationId',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  getOrg
);

// 4. Update Organization Metadata
organizationRouter.patch(
  '/:organizationId',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  validate(updateOrganizationSchema),
  updateOrg
);

// 5. Activate / Deactivate Organization (Platform Superadmin Only)
organizationRouter.patch(
  '/:organizationId/status',
  requireAuth,
  requireRole(UserRole.PLATFORM_ADMIN),
  validate(updateOrgStatusSchema),
  updateOrgStatus
);

// ==============================================================================
// Organization Members Endpoints
// ==============================================================================

// 6. List Members
organizationRouter.get(
  '/:organizationId/members',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  listMembers
);

// 7. Add Member
organizationRouter.post(
  '/:organizationId/members',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  validate(addMemberSchema),
  addMember
);

// 8. Update Member Role / Status
organizationRouter.patch(
  '/:organizationId/members/:userId',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  validate(updateMemberSchema),
  updateMember
);

// 9. Remove / Deactivate Member
organizationRouter.delete(
  '/:organizationId/members/:userId',
  requireAuth,
  requireOrganizationAccess('organizationId'),
  removeMember
);

// ==============================================================================
// Organization Departments Sub-Router
// Mounted at: /api/organizations/:organizationId/departments
// ==============================================================================
organizationRouter.use('/:organizationId/departments', departmentRouter);

export default organizationRouter;
