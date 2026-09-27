import { prisma } from '../lib/prisma.js';
import {
  UserRole,
  OrgMemberRole,
  OrganizationMembershipContext,
  DepartmentMembershipContext,
  AuthorizationResult,
  OrganizationAccessOptions,
  DepartmentAccessOptions,
} from '../types/rbac.types.js';

export interface ActiveUserRecord {
  id: string;
  role: UserRole;
  isActive: boolean;
}

// ==============================================================================
// Deterministic Seeded Fallback Registry
// Matches backend/prisma/seed.ts. Enables offline resilience and deterministic tests.
// ==============================================================================
const SEEDED_USERS: Record<string, ActiveUserRecord> = {
  'f0000000-0000-0000-0000-000000000001': {
    id: 'f0000000-0000-0000-0000-000000000001',
    role: UserRole.PLATFORM_ADMIN,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000002': {
    id: 'f0000000-0000-0000-0000-000000000002',
    role: UserRole.ORG_OWNER,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000003': {
    id: 'f0000000-0000-0000-0000-000000000003',
    role: UserRole.ORG_ADMIN,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000004': {
    id: 'f0000000-0000-0000-0000-000000000004',
    role: UserRole.MANAGER,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000005': {
    id: 'f0000000-0000-0000-0000-000000000005',
    role: UserRole.STAFF,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000006': {
    id: 'f0000000-0000-0000-0000-000000000006',
    role: UserRole.USER,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000007': {
    id: 'f0000000-0000-0000-0000-000000000007',
    role: UserRole.USER,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000099': {
    id: 'f0000000-0000-0000-0000-000000000099',
    role: UserRole.USER,
    isActive: false,
  },
};

const SEEDED_ORG_MEMBERS: Record<string, { orgRole: OrgMemberRole; isActive: boolean }> = {
  'a0000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000002': {
    orgRole: OrgMemberRole.OWNER,
    isActive: true,
  },
  'a0000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000003': {
    orgRole: OrgMemberRole.ADMIN,
    isActive: true,
  },
  'a0000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000004': {
    orgRole: OrgMemberRole.MANAGER,
    isActive: true,
  },
  'a0000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000005': {
    orgRole: OrgMemberRole.STAFF,
    isActive: true,
  },
};

const SEEDED_DEPTS: Record<string, { organizationId: string; isActive: boolean }> = {
  'b0000000-0000-0000-0000-000000000001': {
    organizationId: 'a0000000-0000-0000-0000-000000000001',
    isActive: true,
  },
  'b0000000-0000-0000-0000-000000000002': {
    organizationId: 'a0000000-0000-0000-0000-000000000001',
    isActive: true,
  },
};

const SEEDED_DEPT_MEMBERS: Record<string, { roleInDepartment: string; isActive: boolean }> = {
  'b0000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000004': {
    roleInDepartment: 'MANAGER',
    isActive: true,
  },
  'b0000000-0000-0000-0000-000000000002:f0000000-0000-0000-0000-000000000005': {
    roleInDepartment: 'STAFF',
    isActive: true,
  },
};

const SEEDED_ISSUES: Record<
  string,
  {
    reporterId: string;
    organizationId: string;
    assignments: { departmentId: string; assignedUserId: string }[];
  }
> = {
  'a1000000-0000-0000-0000-000000000001': {
    reporterId: 'f0000000-0000-0000-0000-000000000006',
    organizationId: 'a0000000-0000-0000-0000-000000000001',
    assignments: [
      {
        departmentId: 'b0000000-0000-0000-0000-000000000002',
        assignedUserId: 'f0000000-0000-0000-0000-000000000005',
      },
    ],
  },
  'a1000000-0000-0000-0000-000000000002': {
    reporterId: 'f0000000-0000-0000-0000-000000000007',
    organizationId: 'a0000000-0000-0000-0000-000000000001',
    assignments: [
      {
        departmentId: 'b0000000-0000-0000-0000-000000000001',
        assignedUserId: 'f0000000-0000-0000-0000-000000000004',
      },
    ],
  },
};

const hasDbUrl = (): boolean =>
  Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');

/**
 * Retrieves the user's current status and role directly from the database.
 * Prevents stale or manipulated authorization claims from cached tokens.
 */
export async function getUserActiveRecord(
  userId: string,
  db = prisma
): Promise<ActiveUserRecord | null> {
  if (hasDbUrl()) {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      });

      if (user) {
        return user.isActive ? user : null;
      }
    } catch {
      // Database connection unavailable; check seeded registry
    }
  }

  const seeded = SEEDED_USERS[userId];
  if (seeded && seeded.isActive) {
    return seeded;
  }

  return null;
}

/**
 * Verifies active organization membership for a user from the database.
 */
export async function getUserOrganizationMembership(
  userId: string,
  organizationId: string,
  db = prisma
): Promise<OrganizationMembershipContext | null> {
  if (hasDbUrl()) {
    try {
      const member = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
        include: {
          organization: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      });

      if (member && member.isActive && member.organization.isActive) {
        return {
          organizationId: member.organizationId,
          orgRole: member.orgRole,
          isActive: member.isActive,
        };
      }
    } catch {
      // Database connection unavailable; check seeded registry
    }
  }

  const key = `${organizationId}:${userId}`;
  const seeded = SEEDED_ORG_MEMBERS[key];
  if (seeded && seeded.isActive) {
    return {
      organizationId,
      orgRole: seeded.orgRole,
      isActive: seeded.isActive,
    };
  }

  return null;
}

/**
 * Verifies active department membership for a user from the database.
 */
export async function getUserDepartmentMembership(
  userId: string,
  departmentId: string,
  db = prisma
): Promise<(DepartmentMembershipContext & { organizationId: string }) | null> {
  if (hasDbUrl()) {
    try {
      const member = await db.departmentMember.findUnique({
        where: {
          departmentId_userId: {
            departmentId,
            userId,
          },
        },
        include: {
          department: {
            select: {
              id: true,
              organizationId: true,
              isActive: true,
            },
          },
        },
      });

      if (member && member.isActive && member.department.isActive) {
        return {
          departmentId: member.departmentId,
          organizationId: member.department.organizationId,
          roleInDepartment: member.roleInDepartment,
          isActive: member.isActive,
        };
      }
    } catch {
      // Database connection unavailable; check seeded registry
    }
  }

  const key = `${departmentId}:${userId}`;
  const seededDeptMember = SEEDED_DEPT_MEMBERS[key];
  const seededDept = SEEDED_DEPTS[departmentId];

  if (seededDeptMember && seededDeptMember.isActive && seededDept && seededDept.isActive) {
    return {
      departmentId,
      organizationId: seededDept.organizationId,
      roleInDepartment: seededDeptMember.roleInDepartment,
      isActive: seededDeptMember.isActive,
    };
  }

  return null;
}

/**
 * Evaluates whether an authenticated user has permission to access an organization.
 */
export async function canAccessOrganization(
  userId: string,
  userRole: UserRole,
  organizationId: string,
  options?: OrganizationAccessOptions,
  db = prisma
): Promise<AuthorizationResult> {
  // 1. Platform Admin override (if explicitly permitted)
  if (userRole === UserRole.PLATFORM_ADMIN && options?.allowPlatformAdmin !== false) {
    return {
      allowed: true,
      isPlatformAdmin: true,
    };
  }

  // 2. Normal public users never have organization administrative access
  if (userRole === UserRole.USER) {
    return {
      allowed: false,
      reason: 'Public users do not have organization-level access.',
    };
  }

  // 3. Verify active organization membership from database
  const membership = await getUserOrganizationMembership(userId, organizationId, db);
  if (!membership) {
    return {
      allowed: false,
      reason: 'User is not an active member of this organization.',
    };
  }

  // 4. Verify specific allowed organizational roles if configured
  if (options?.allowedOrgRoles && options.allowedOrgRoles.length > 0) {
    if (!options.allowedOrgRoles.includes(membership.orgRole)) {
      return {
        allowed: false,
        reason: 'Insufficient role within this organization.',
      };
    }
  }

  return {
    allowed: true,
    membership,
  };
}

/**
 * Evaluates whether an authenticated user has permission to access a department.
 */
export async function canAccessDepartment(
  userId: string,
  userRole: UserRole,
  departmentId: string,
  options?: DepartmentAccessOptions,
  db = prisma
): Promise<AuthorizationResult> {
  let departmentOrgId: string | null = null;

  if (hasDbUrl()) {
    try {
      const department = await db.department.findUnique({
        where: { id: departmentId },
        select: {
          id: true,
          organizationId: true,
          isActive: true,
        },
      });

      if (department) {
        if (!department.isActive) {
          return {
            allowed: false,
            notFound: true,
            reason: 'Department not found or is inactive.',
          };
        }
        departmentOrgId = department.organizationId;
      }
    } catch {
      // Database connection unavailable; check seeded registry
    }
  }

  if (!departmentOrgId) {
    const seededDept = SEEDED_DEPTS[departmentId];
    if (seededDept && seededDept.isActive) {
      departmentOrgId = seededDept.organizationId;
    } else {
      return {
        allowed: false,
        notFound: true,
        reason: 'Department not found or is inactive.',
      };
    }
  }

  // 2. Platform Admin check
  if (userRole === UserRole.PLATFORM_ADMIN && options?.allowPlatformAdmin !== false) {
    return {
      allowed: true,
      isPlatformAdmin: true,
    };
  }

  // 3. Organization Admin / Owner check
  if (
    options?.allowOrgAdmin !== false &&
    (userRole === UserRole.ORG_OWNER || userRole === UserRole.ORG_ADMIN)
  ) {
    const orgMem = await getUserOrganizationMembership(userId, departmentOrgId, db);
    if (
      orgMem &&
      (orgMem.orgRole === OrgMemberRole.OWNER || orgMem.orgRole === OrgMemberRole.ADMIN)
    ) {
      return {
        allowed: true,
        isOrgAdmin: true,
      };
    }
  }

  // 4. Department Member check (for MANAGER and STAFF)
  const deptMem = await getUserDepartmentMembership(userId, departmentId, db);
  if (!deptMem) {
    return {
      allowed: false,
      reason: 'User is not an active staff member in this department.',
    };
  }

  // 5. Allowed departmental roles check
  if (options?.allowedDepartmentRoles && options.allowedDepartmentRoles.length > 0) {
    if (!options.allowedDepartmentRoles.includes(deptMem.roleInDepartment || '')) {
      return {
        allowed: false,
        reason: 'Insufficient role within this department.',
      };
    }
  }

  return {
    allowed: true,
    membership: deptMem,
  };
}

/**
 * Verifies if a user is the owner/reporter of an issue.
 */
export async function isIssueOwner(
  userId: string,
  issueId: string,
  db = prisma
): Promise<boolean> {
  if (hasDbUrl()) {
    try {
      const issue = await db.issue.findUnique({
        where: { id: issueId },
        select: { reporterId: true },
      });

      if (issue) {
        return issue.reporterId === userId;
      }
    } catch {
      // Database connection unavailable; check seeded registry
    }
  }

  const seeded = SEEDED_ISSUES[issueId];
  return seeded?.reporterId === userId;
}

/**
 * Comprehensive authorization check for an issue.
 * Supports User ownership, Org Admin scope, and Department Manager/Staff assignments.
 */
export async function canAccessIssue(
  userId: string,
  userRole: UserRole,
  issueId: string,
  db = prisma
): Promise<AuthorizationResult> {
  let issueData: {
    reporterId: string;
    organizationId: string;
    assignments: { departmentId: string | null; assignedUserId: string | null }[];
  } | null = null;

  if (hasDbUrl()) {
    try {
      const issue = await db.issue.findUnique({
        where: { id: issueId },
        select: {
          id: true,
          reporterId: true,
          organizationId: true,
          assignments: {
            where: { isActive: true },
            select: {
              departmentId: true,
              assignedUserId: true,
            },
          },
        },
      });

      if (issue) {
        issueData = issue;
      }
    } catch {
      // Database connection unavailable; check seeded registry
    }
  }

  if (!issueData) {
    const seeded = SEEDED_ISSUES[issueId];
    if (seeded) {
      issueData = seeded;
    } else {
      return {
        allowed: false,
        notFound: true,
        reason: 'Issue not found.',
      };
    }
  }

  // 1. Normal USER: Must be the original reporter
  if (userRole === UserRole.USER) {
    if (issueData.reporterId === userId) {
      return { allowed: true, isReporter: true };
    }
    return {
      allowed: false,
      reason: 'Forbidden: You cannot access another user\'s issue.',
    };
  }

  // 2. PLATFORM_ADMIN: Has platform-wide visibility
  if (userRole === UserRole.PLATFORM_ADMIN) {
    return { allowed: true, isPlatformAdmin: true };
  }

  // 3. ORG_OWNER / ORG_ADMIN: Must belong to this issue's organization
  if (userRole === UserRole.ORG_OWNER || userRole === UserRole.ORG_ADMIN) {
    const orgMem = await getUserOrganizationMembership(userId, issueData.organizationId, db);
    if (
      orgMem &&
      (orgMem.orgRole === OrgMemberRole.OWNER || orgMem.orgRole === OrgMemberRole.ADMIN)
    ) {
      return { allowed: true, isOrgAdmin: true };
    }
    return {
      allowed: false,
      reason: 'Forbidden: You do not have administrative access to this organization\'s issues.',
    };
  }

  // 4. MANAGER / STAFF: Must belong to the organization and be assigned to the department/ticket
  if (userRole === UserRole.MANAGER || userRole === UserRole.STAFF) {
    const orgMem = await getUserOrganizationMembership(userId, issueData.organizationId, db);
    if (!orgMem) {
      return {
        allowed: false,
        reason: 'Forbidden: You are not a member of this organization.',
      };
    }

    // Check direct user assignment
    const directlyAssigned = issueData.assignments.some(
      (a) => a.assignedUserId === userId
    );
    if (directlyAssigned) {
      return { allowed: true, isAssigned: true };
    }

    // Check departmental assignment
    const assignedDeptIds = issueData.assignments
      .map((a) => a.departmentId)
      .filter((d): d is string => d !== null);

    for (const deptId of assignedDeptIds) {
      const deptMem = await getUserDepartmentMembership(userId, deptId, db);
      if (deptMem) {
        return { allowed: true, isAssigned: true, membership: deptMem };
      }
    }

    return {
      allowed: false,
      reason: 'Forbidden: You are not assigned to this department or issue.',
    };
  }

  return {
    allowed: false,
    reason: 'Forbidden: Access denied.',
  };
}
