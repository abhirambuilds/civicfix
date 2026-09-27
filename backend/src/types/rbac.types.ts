import { UserRole, OrgMemberRole } from '@prisma/client';

export { UserRole, OrgMemberRole };

export interface OrganizationMembershipContext {
  organizationId: string;
  orgRole: OrgMemberRole;
  isActive: boolean;
}

export interface DepartmentMembershipContext {
  departmentId: string;
  roleInDepartment?: string | null;
  isActive: boolean;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  isPlatformAdmin?: boolean;
  isOrgAdmin?: boolean;
  isAssigned?: boolean;
  isReporter?: boolean;
  notFound?: boolean;
  membership?: unknown;
}

export interface OrganizationAccessOptions {
  /**
   * Specific roles within the organization allowed access (e.g. [OWNER, ADMIN]).
   * If omitted, any active organization member is permitted.
   */
  allowedOrgRoles?: OrgMemberRole[];
  /**
   * Whether PLATFORM_ADMIN is granted platform-wide override access.
   * Default: true.
   */
  allowPlatformAdmin?: boolean;
}

export interface DepartmentAccessOptions {
  /**
   * Departmental operational roles allowed access (e.g. ['MANAGER']).
   * If omitted, any active department member is permitted.
   */
  allowedDepartmentRoles?: string[];
  /**
   * Whether PLATFORM_ADMIN is granted access. Default: true.
   */
  allowPlatformAdmin?: boolean;
  /**
   * Whether ORG_OWNER or ORG_ADMIN of the parent organization can access the department.
   * Default: true.
   */
  allowOrgAdmin?: boolean;
}

export interface UserOwnershipOptions {
  /**
   * Whether PLATFORM_ADMIN can access another user's resources. Default: false.
   */
  allowPlatformAdmin?: boolean;
}
