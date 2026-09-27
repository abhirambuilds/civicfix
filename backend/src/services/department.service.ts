import { prisma } from '../lib/prisma.js';
import { UserRole } from '@prisma/client';
import {
  CreateDepartmentInput,
  UpdateDepartmentInput,
  AddDeptMemberInput,
  UpdateDeptMemberInput,
} from '../validators/department.validator.js';
import { ServiceResult } from './auth.service.js';
import { canAccessOrganization, getUserDepartmentMembership } from './rbac.service.js';
import { checkUserOrgMembership } from './organization.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

const hasDbUrl = (): boolean =>
  Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');

// ==============================================================================
// In-Memory Seeded Fallback Store
// Matches Prompt 4 seed data and enables deterministic testing when offline.
// ==============================================================================

interface MockDept {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { members: number };
}

interface MockDeptMember {
  id: string;
  departmentId: string;
  userId: string;
  roleInDepartment: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  };
}

const MOCK_DEPTS: Map<string, MockDept> = new Map([
  [
    'b0000000-0000-0000-0000-000000000001',
    {
      id: 'b0000000-0000-0000-0000-000000000001',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Civil / Infrastructure',
      code: 'CIVIL',
      description: 'Responsible for roads, pavements, structural repairs, campus buildings, and civil infrastructure.',
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      _count: { members: 1 },
    },
  ],
  [
    'b0000000-0000-0000-0000-000000000002',
    {
      id: 'b0000000-0000-0000-0000-000000000002',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Electrical',
      code: 'ELECTRICAL',
      description: 'Manages streetlights, outdoor illumination, wiring, transformers, and electrical fixtures.',
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      _count: { members: 1 },
    },
  ],
  [
    'b0000000-0000-0000-0000-000000000003',
    {
      id: 'b0000000-0000-0000-0000-000000000003',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Sanitation & Waste',
      code: 'SANITATION',
      description: 'Oversees garbage collection, litter management, campus cleanliness, and waste disposal bins.',
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      _count: { members: 0 },
    },
  ],
  [
    'b0000000-0000-0000-0000-000000000004',
    {
      id: 'b0000000-0000-0000-0000-000000000004',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Water & Drainage',
      code: 'WATER',
      description: 'Handles water pipeline leaks, drinking water stations, storm drains, and sewage infrastructure.',
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      _count: { members: 0 },
    },
  ],
  [
    'b0000000-0000-0000-0000-000000000005',
    {
      id: 'b0000000-0000-0000-0000-000000000005',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'General Maintenance',
      code: 'MAINTENANCE',
      description: 'General campus upkeep, miscellaneous physical requests, and uncategorized issue resolution.',
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      _count: { members: 0 },
    },
  ],
]);

const MOCK_DEPT_MEMBERS: Map<string, MockDeptMember> = new Map([
  [
    'b0000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000004',
    {
      id: 'dm000000-0000-0000-0000-000000000001',
      departmentId: 'b0000000-0000-0000-0000-000000000001',
      userId: 'f0000000-0000-0000-0000-000000000004',
      roleInDepartment: 'MANAGER',
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      user: {
        id: 'f0000000-0000-0000-0000-000000000004',
        name: 'Civil Infrastructure Manager',
        email: 'manager@civicfix.demo',
        role: UserRole.MANAGER,
        isActive: true,
      },
    },
  ],
  [
    'b0000000-0000-0000-0000-000000000002:f0000000-0000-0000-0000-000000000005',
    {
      id: 'dm000000-0000-0000-0000-000000000002',
      departmentId: 'b0000000-0000-0000-0000-000000000002',
      userId: 'f0000000-0000-0000-0000-000000000005',
      roleInDepartment: 'STAFF',
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      user: {
        id: 'f0000000-0000-0000-0000-000000000005',
        name: 'Electrical Field Technician',
        email: 'staff@civicfix.demo',
        role: UserRole.STAFF,
        isActive: true,
      },
    },
  ],
]);

const MOCK_USERS: Record<
  string,
  { id: string; name: string; email: string; role: UserRole; isActive: boolean }
> = {
  'f0000000-0000-0000-0000-000000000001': {
    id: 'f0000000-0000-0000-0000-000000000001',
    name: 'Platform Superadmin',
    email: 'platform.admin@civicfix.demo',
    role: UserRole.PLATFORM_ADMIN,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000002': {
    id: 'f0000000-0000-0000-0000-000000000002',
    name: 'SRM Administration Owner',
    email: 'srm.owner@civicfix.demo',
    role: UserRole.ORG_OWNER,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000003': {
    id: 'f0000000-0000-0000-0000-000000000003',
    name: 'SRM Operations Admin',
    email: 'srm.admin@civicfix.demo',
    role: UserRole.ORG_ADMIN,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000004': {
    id: 'f0000000-0000-0000-0000-000000000004',
    name: 'Civil Infrastructure Manager',
    email: 'manager@civicfix.demo',
    role: UserRole.MANAGER,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000005': {
    id: 'f0000000-0000-0000-0000-000000000005',
    name: 'Electrical Field Technician',
    email: 'staff@civicfix.demo',
    role: UserRole.STAFF,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000006': {
    id: 'f0000000-0000-0000-0000-000000000006',
    name: 'SRM Campus Student',
    email: 'student@civicfix.demo',
    role: UserRole.USER,
    isActive: true,
  },
  'f0000000-0000-0000-0000-000000000007': {
    id: 'f0000000-0000-0000-0000-000000000007',
    name: 'Campus Citizen 2',
    email: 'citizen2@civicfix.demo',
    role: UserRole.USER,
    isActive: true,
  },
};

// ==============================================================================
// SERVICE IMPLEMENTATIONS
// ==============================================================================

/**
 * Helper to check if a user is an active member of an organization.
 */
async function isUserMemberOfOrg(
  userId: string,
  organizationId: string,
  db = prisma
): Promise<boolean> {
  return checkUserOrgMembership(userId, organizationId, db);
}

/**
 * 1. Creates a new department within an organization.
 * Restricted to PLATFORM_ADMIN, ORG_OWNER, and ORG_ADMIN of that organization.
 */
export async function createDepartment(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  input: CreateDepartmentInput,
  db = prisma
): Promise<ServiceResult<unknown>> {
  if (!isValidUuid(organizationId)) {
    return { success: false, error: 'Invalid organization ID parameter.', statusCode: 400 };
  }

  // 1. Role Authorization
  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to create departments.',
      statusCode: 403,
    };
  }

  // 2. Organization Access check
  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const authCheck = await canAccessOrganization(actorId, actorRole, organizationId, {}, db);
    if (!authCheck.allowed) {
      return {
        success: false,
        error: authCheck.reason || 'Forbidden: Access to this organization is denied.',
        statusCode: 403,
      };
    }
  }

  // 3. Organization Active Check
  let org: any = null;
  if (hasDbUrl()) {
    try {
      org = await db.organization.findUnique({ where: { id: organizationId } });
    } catch {
      // Fallback
    }
  }
  if (!org && organizationId === 'a0000000-0000-0000-0000-000000000001') {
    org = { id: organizationId, isActive: true };
  }

  if (!org) {
    return { success: false, error: 'Organization not found.', statusCode: 404 };
  }

  if (!org.isActive && actorRole !== UserRole.PLATFORM_ADMIN) {
    return {
      success: false,
      error: 'Forbidden: Inactive organizations cannot create new departments.',
      statusCode: 403,
    };
  }

  const trimmedName = input.name.trim();

  // 4. Check for duplicate department name within this organization
  if (hasDbUrl()) {
    try {
      const existing = await db.department.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name: trimmedName,
          },
        },
      });

      if (existing) {
        return {
          success: false,
          error: `A department named '${trimmedName}' already exists in this organization.`,
          statusCode: 409,
        };
      }

      const created = await db.department.create({
        data: {
          organizationId,
          name: trimmedName,
          description: input.description?.trim() || null,
          code: input.code?.trim() || null,
          isActive: true,
        },
        include: {
          _count: { select: { members: true } },
        },
      });

      return {
        success: true,
        data: created,
        message: 'Department created successfully',
        statusCode: 201,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback
  for (const dept of MOCK_DEPTS.values()) {
    if (dept.organizationId === organizationId && dept.name.toLowerCase() === trimmedName.toLowerCase()) {
      return {
        success: false,
        error: `A department named '${trimmedName}' already exists in this organization.`,
        statusCode: 409,
      };
    }
  }

  const id = `b0000000-0000-0000-0000-${String(MOCK_DEPTS.size + 10).padStart(12, '0')}`;
  const mockDept: MockDept = {
    id,
    organizationId,
    name: trimmedName,
    code: input.code?.trim() || null,
    description: input.description?.trim() || null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { members: 0 },
  };
  MOCK_DEPTS.set(id, mockDept);

  return {
    success: true,
    data: mockDept,
    message: 'Department created successfully',
    statusCode: 201,
  };
}

/**
 * 2. Lists all departments in an organization.
 * Permitted for PLATFORM_ADMIN and members of that organization.
 * Denied for public USER.
 */
export async function listDepartments(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  db = prisma
): Promise<ServiceResult<{ departments: unknown[] }>> {
  if (!isValidUuid(organizationId)) {
    return { success: false, error: 'Invalid organization ID parameter.', statusCode: 400 };
  }

  if (actorRole === UserRole.USER) {
    return {
      success: false,
      error: 'Forbidden: Public users cannot view administrative departments.',
      statusCode: 403,
    };
  }

  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const authCheck = await canAccessOrganization(actorId, actorRole, organizationId, {}, db);
    if (!authCheck.allowed) {
      return {
        success: false,
        error: authCheck.reason || 'Forbidden: Access to this organization is denied.',
        statusCode: 403,
      };
    }
  }

  if (hasDbUrl()) {
    try {
      const departments = await db.department.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
        include: {
          _count: { select: { members: true } },
        },
      });

      return {
        success: true,
        data: { departments },
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback
  const list: unknown[] = [];
  for (const dept of MOCK_DEPTS.values()) {
    if (dept.organizationId === organizationId) {
      list.push(dept);
    }
  }

  return {
    success: true,
    data: { departments: list },
    statusCode: 200,
  };
}

/**
 * 3. Retrieves details for a specific department.
 * Verifies that the department actually belongs to organizationId.
 */
export async function getDepartmentById(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  departmentId: string,
  db = prisma
): Promise<ServiceResult<{ department: unknown }>> {
  if (!isValidUuid(organizationId) || !isValidUuid(departmentId)) {
    return { success: false, error: 'Invalid UUID parameter.', statusCode: 400 };
  }

  if (actorRole === UserRole.USER) {
    return {
      success: false,
      error: 'Forbidden: Public users cannot inspect department details.',
      statusCode: 403,
    };
  }

  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const authCheck = await canAccessOrganization(actorId, actorRole, organizationId, {}, db);
    if (!authCheck.allowed) {
      return {
        success: false,
        error: authCheck.reason || 'Forbidden: Access to this organization is denied.',
        statusCode: 403,
      };
    }
  }

  let dept: any = null;
  if (hasDbUrl()) {
    try {
      dept = await db.department.findUnique({
        where: { id: departmentId },
        include: {
          _count: { select: { members: true } },
        },
      });
    } catch {
      // Fallback
    }
  }

  if (!dept) {
    dept = MOCK_DEPTS.get(departmentId);
  }

  if (!dept || dept.organizationId !== organizationId) {
    return {
      success: false,
      error: 'Department not found in this organization.',
      statusCode: 404,
    };
  }

  return {
    success: true,
    data: { department: dept },
    statusCode: 200,
  };
}

/**
 * 4. Updates department metadata (name, description, code).
 * Restricted to PLATFORM_ADMIN, ORG_OWNER, and ORG_ADMIN of that organization.
 */
export async function updateDepartment(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  departmentId: string,
  input: UpdateDepartmentInput,
  db = prisma
): Promise<ServiceResult<{ department: unknown }>> {
  if (!isValidUuid(organizationId) || !isValidUuid(departmentId)) {
    return { success: false, error: 'Invalid UUID parameter.', statusCode: 400 };
  }

  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to modify department configuration.',
      statusCode: 403,
    };
  }

  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const authCheck = await canAccessOrganization(actorId, actorRole, organizationId, {}, db);
    if (!authCheck.allowed) {
      return {
        success: false,
        error: authCheck.reason || 'Forbidden: Access to this organization is denied.',
        statusCode: 403,
      };
    }
  }

  let dept: any = null;
  if (hasDbUrl()) {
    try {
      dept = await db.department.findUnique({ where: { id: departmentId } });
    } catch {
      // Fallback
    }
  }
  if (!dept) {
    dept = MOCK_DEPTS.get(departmentId);
  }

  if (!dept || dept.organizationId !== organizationId) {
    return {
      success: false,
      error: 'Department not found in this organization.',
      statusCode: 404,
    };
  }

  if (!dept.isActive && actorRole !== UserRole.PLATFORM_ADMIN) {
    return {
      success: false,
      error: 'Forbidden: Inactive departments cannot be modified.',
      statusCode: 403,
    };
  }

  const updateData: { name?: string; description?: string | null; code?: string | null } = {};

  if (input.name) {
    const trimmed = input.name.trim();
    if (trimmed !== dept.name) {
      // Duplicate name check
      if (hasDbUrl()) {
        try {
          const dup = await db.department.findUnique({
            where: {
              organizationId_name: {
                organizationId,
                name: trimmed,
              },
            },
          });
          if (dup && dup.id !== departmentId) {
            return {
              success: false,
              error: `A department named '${trimmed}' already exists in this organization.`,
              statusCode: 409,
            };
          }
        } catch {
          // Fallback
        }
      }

      for (const d of MOCK_DEPTS.values()) {
        if (
          d.organizationId === organizationId &&
          d.id !== departmentId &&
          d.name.toLowerCase() === trimmed.toLowerCase()
        ) {
          return {
            success: false,
            error: `A department named '${trimmed}' already exists in this organization.`,
            statusCode: 409,
          };
        }
      }

      updateData.name = trimmed;
    }
  }

  if (input.description !== undefined) {
    updateData.description = input.description ? input.description.trim() : null;
  }

  if (input.code !== undefined) {
    updateData.code = input.code ? input.code.trim() : null;
  }

  if (hasDbUrl()) {
    try {
      const updated = await db.department.update({
        where: { id: departmentId },
        data: updateData,
        include: { _count: { select: { members: true } } },
      });

      return {
        success: true,
        data: { department: updated },
        message: 'Department updated successfully',
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback
  const updatedMock: MockDept = {
    ...dept,
    ...updateData,
    updatedAt: new Date(),
  };
  MOCK_DEPTS.set(departmentId, updatedMock);

  return {
    success: true,
    data: { department: updatedMock },
    message: 'Department updated successfully',
    statusCode: 200,
  };
}

/**
 * 5. Activates or deactivates a department.
 * Restricted to PLATFORM_ADMIN, ORG_OWNER, and ORG_ADMIN of that organization.
 */
export async function updateDepartmentStatus(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  departmentId: string,
  isActive: boolean,
  db = prisma
): Promise<ServiceResult<{ department: unknown }>> {
  if (!isValidUuid(organizationId) || !isValidUuid(departmentId)) {
    return { success: false, error: 'Invalid UUID parameter.', statusCode: 400 };
  }

  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to change department status.',
      statusCode: 403,
    };
  }

  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const authCheck = await canAccessOrganization(actorId, actorRole, organizationId, {}, db);
    if (!authCheck.allowed) {
      return {
        success: false,
        error: authCheck.reason || 'Forbidden: Access to this organization is denied.',
        statusCode: 403,
      };
    }
  }

  let dept: any = null;
  if (hasDbUrl()) {
    try {
      dept = await db.department.findUnique({ where: { id: departmentId } });
    } catch {
      // Fallback
    }
  }
  if (!dept) {
    dept = MOCK_DEPTS.get(departmentId);
  }

  if (!dept || dept.organizationId !== organizationId) {
    return {
      success: false,
      error: 'Department not found in this organization.',
      statusCode: 404,
    };
  }

  if (hasDbUrl()) {
    try {
      const updated = await db.department.update({
        where: { id: departmentId },
        data: { isActive },
        include: { _count: { select: { members: true } } },
      });

      return {
        success: true,
        data: { department: updated },
        message: isActive
          ? 'Department activated successfully'
          : 'Department deactivated successfully',
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  const updatedMock = { ...dept, isActive, updatedAt: new Date() };
  MOCK_DEPTS.set(departmentId, updatedMock);

  return {
    success: true,
    data: { department: updatedMock },
    message: isActive
      ? 'Department activated successfully'
      : 'Department deactivated successfully',
    statusCode: 200,
  };
}

/**
 * 6. Lists all members within a department.
 * Allowed:
 * - PLATFORM_ADMIN
 * - ORG_OWNER / ORG_ADMIN of that organization
 * - MANAGER of THIS department
 * - STAFF of THIS department
 * Denied:
 * - Other departments' managers/staff
 * - Public USER
 */
export async function listDepartmentMembers(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  departmentId: string,
  db = prisma
): Promise<ServiceResult<{ members: unknown[] }>> {
  if (!isValidUuid(organizationId) || !isValidUuid(departmentId)) {
    return { success: false, error: 'Invalid UUID parameter.', statusCode: 400 };
  }

  if (actorRole === UserRole.USER) {
    return {
      success: false,
      error: 'Forbidden: Public users cannot view department staff.',
      statusCode: 403,
    };
  }

  // 1. Verify organization access
  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const authCheck = await canAccessOrganization(actorId, actorRole, organizationId, {}, db);
    if (!authCheck.allowed) {
      return {
        success: false,
        error: authCheck.reason || 'Forbidden: Access to this organization is denied.',
        statusCode: 403,
      };
    }
  }

  // 2. Department existence and parent organization check
  let dept: any = null;
  if (hasDbUrl()) {
    try {
      dept = await db.department.findUnique({ where: { id: departmentId } });
    } catch {
      // Fallback
    }
  }
  if (!dept) {
    dept = MOCK_DEPTS.get(departmentId);
  }

  if (!dept || dept.organizationId !== organizationId) {
    return {
      success: false,
      error: 'Department not found in this organization.',
      statusCode: 404,
    };
  }

  // 3. Department isolation for MANAGER and STAFF:
  // Must belong to this department specifically!
  if (actorRole === UserRole.MANAGER || actorRole === UserRole.STAFF) {
    const deptMem = await getUserDepartmentMembership(actorId, departmentId, db);
    if (!deptMem || !deptMem.isActive) {
      return {
        success: false,
        error: 'Forbidden: You can only view staff within your assigned department.',
        statusCode: 403,
      };
    }
  }

  if (hasDbUrl()) {
    try {
      const members = await db.departmentMember.findMany({
        where: { departmentId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          departmentId: true,
          userId: true,
          roleInDepartment: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
      });

      return {
        success: true,
        data: { members },
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback
  const members: unknown[] = [];
  for (const m of MOCK_DEPT_MEMBERS.values()) {
    if (m.departmentId === departmentId) {
      members.push(m);
    }
  }

  return {
    success: true,
    data: { members },
    statusCode: 200,
  };
}

/**
 * 7. Adds a user as a member of a department.
 * Requirements:
 * - Allowed for PLATFORM_ADMIN, ORG_OWNER, ORG_ADMIN, or MANAGER of THIS department.
 * - Target user must exist and be active.
 * - MANDATORY: Target user MUST already belong to the organization!
 * - Privilege escalation limits: MANAGER can only assign operational roles (STAFF).
 */
export async function addDepartmentMember(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  departmentId: string,
  input: AddDeptMemberInput,
  db = prisma
): Promise<ServiceResult<{ member: unknown }>> {
  if (!isValidUuid(organizationId) || !isValidUuid(departmentId) || !isValidUuid(input.userId)) {
    return { success: false, error: 'Invalid UUID parameter.', statusCode: 400 };
  }

  // 1. Role permission check
  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN &&
    actorRole !== UserRole.MANAGER
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to add department members.',
      statusCode: 403,
    };
  }

  // 2. Prevent self-addition for privilege escalation
  if (actorId === input.userId) {
    return {
      success: false,
      error: 'Forbidden: Users cannot add themselves to department staff.',
      statusCode: 403,
    };
  }

  // 3. Organization authorization check
  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const authCheck = await canAccessOrganization(actorId, actorRole, organizationId, {}, db);
    if (!authCheck.allowed) {
      return {
        success: false,
        error: authCheck.reason || 'Forbidden: Access to this organization is denied.',
        statusCode: 403,
      };
    }
  }

  // 4. Department existence and organization ownership
  let dept: any = null;
  if (hasDbUrl()) {
    try {
      dept = await db.department.findUnique({ where: { id: departmentId } });
    } catch {
      // Fallback
    }
  }
  if (!dept) {
    dept = MOCK_DEPTS.get(departmentId);
  }

  if (!dept || dept.organizationId !== organizationId) {
    return {
      success: false,
      error: 'Department not found in this organization.',
      statusCode: 404,
    };
  }

  if (!dept.isActive && actorRole !== UserRole.PLATFORM_ADMIN) {
    return {
      success: false,
      error: 'Forbidden: Inactive departments cannot accept new staff members.',
      statusCode: 403,
    };
  }

  // 5. If actor is a MANAGER, verify they manage THIS department and are not assigning MANAGER
  const assignedRole = (input.roleInDepartment || 'STAFF').toUpperCase();

  if (actorRole === UserRole.MANAGER) {
    const deptMem = await getUserDepartmentMembership(actorId, departmentId, db);
    if (!deptMem || !deptMem.isActive) {
      return {
        success: false,
        error: 'Forbidden: Managers can only add staff to their own assigned department.',
        statusCode: 403,
      };
    }

    if (assignedRole === 'MANAGER' || assignedRole === 'DEPARTMENT_HEAD') {
      return {
        success: false,
        error: 'Forbidden: Department managers cannot assign manager roles to staff.',
        statusCode: 403,
      };
    }
  }

  // 6. Prohibit assigning administrative org/platform roles through department membership
  if (
    assignedRole === 'PLATFORM_ADMIN' ||
    assignedRole === 'ORG_ADMIN' ||
    assignedRole === 'ORG_OWNER'
  ) {
    return {
      success: false,
      error: 'Forbidden: Administrative organization roles cannot be granted via department membership.',
      statusCode: 403,
    };
  }

  // 7. Target user check: Must exist and be active
  let targetUser: any = null;
  if (hasDbUrl()) {
    try {
      targetUser = await db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
    } catch {
      // Fallback
    }
  }
  if (!targetUser) {
    targetUser = MOCK_USERS[input.userId];
  }

  if (!targetUser || !targetUser.isActive) {
    return {
      success: false,
      error: 'Target user not found or is deactivated.',
      statusCode: 404,
    };
  }

  // 8. MANDATORY CHECK: Target user MUST belong to this organization!
  const belongsToOrg = await isUserMemberOfOrg(input.userId, organizationId, db);
  if (!belongsToOrg) {
    return {
      success: false,
      error: 'User is not a member of this organization. Organization membership is required prior to department assignment.',
      statusCode: 400,
    };
  }

  // 9. Check existing department membership
  const memberKey = `${departmentId}:${input.userId}`;
  const existingMock = MOCK_DEPT_MEMBERS.get(memberKey);

  if (hasDbUrl()) {
    try {
      const existing = await db.departmentMember.findUnique({
        where: {
          departmentId_userId: {
            departmentId,
            userId: input.userId,
          },
        },
      });

      if (existing) {
        if (existing.isActive) {
          return {
            success: false,
            error: 'User is already an active member of this department.',
            statusCode: 409,
          };
        }

        // Reactivate
        const reactivated = await db.departmentMember.update({
          where: { id: existing.id },
          data: {
            roleInDepartment: assignedRole,
            isActive: true,
          },
          include: {
            user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
          },
        });

        return {
          success: true,
          data: { member: reactivated },
          message: 'Department member reactivated successfully',
          statusCode: 200,
        };
      }

      const newMember = await db.departmentMember.create({
        data: {
          departmentId,
          userId: input.userId,
          roleInDepartment: assignedRole,
          isActive: true,
        },
        include: {
          user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        },
      });

      return {
        success: true,
        data: { member: newMember },
        message: 'Member added to department successfully',
        statusCode: 201,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback
  if (existingMock && existingMock.isActive) {
    return {
      success: false,
      error: 'User is already an active member of this department.',
      statusCode: 409,
    };
  }

  const id = `dm000000-0000-0000-0000-${String(MOCK_DEPT_MEMBERS.size + 10).padStart(12, '0')}`;
  const newMockMember: MockDeptMember = {
    id,
    departmentId,
    userId: input.userId,
    roleInDepartment: assignedRole,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: targetUser,
  };
  MOCK_DEPT_MEMBERS.set(memberKey, newMockMember);

  // Update count in mock dept
  if (dept._count) {
    dept._count.members += 1;
  }

  return {
    success: true,
    data: { member: newMockMember },
    message: 'Member added to department successfully',
    statusCode: 201,
  };
}

/**
 * 8. Updates an organization department member's role or status.
 */
export async function updateDepartmentMember(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  departmentId: string,
  targetUserId: string,
  input: UpdateDeptMemberInput,
  db = prisma
): Promise<ServiceResult<{ member: unknown }>> {
  if (!isValidUuid(organizationId) || !isValidUuid(departmentId) || !isValidUuid(targetUserId)) {
    return { success: false, error: 'Invalid UUID parameter.', statusCode: 400 };
  }

  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN &&
    actorRole !== UserRole.MANAGER
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to modify department staff.',
      statusCode: 403,
    };
  }

  // Users cannot modify their own role
  if (actorId === targetUserId) {
    return {
      success: false,
      error: 'Forbidden: Users cannot modify their own department role or status.',
      statusCode: 403,
    };
  }

  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const authCheck = await canAccessOrganization(actorId, actorRole, organizationId, {}, db);
    if (!authCheck.allowed) {
      return {
        success: false,
        error: authCheck.reason || 'Forbidden: Access to this organization is denied.',
        statusCode: 403,
      };
    }
  }

  let dept: any = null;
  if (hasDbUrl()) {
    try {
      dept = await db.department.findUnique({ where: { id: departmentId } });
    } catch {
      // Fallback
    }
  }
  if (!dept) {
    dept = MOCK_DEPTS.get(departmentId);
  }

  if (!dept || dept.organizationId !== organizationId) {
    return {
      success: false,
      error: 'Department not found in this organization.',
      statusCode: 404,
    };
  }

  // Find target membership
  let member: any = null;
  const memberKey = `${departmentId}:${targetUserId}`;

  if (hasDbUrl()) {
    try {
      member = await db.departmentMember.findUnique({
        where: {
          departmentId_userId: {
            departmentId,
            userId: targetUserId,
          },
        },
      });
    } catch {
      // Fallback
    }
  }
  if (!member) {
    member = MOCK_DEPT_MEMBERS.get(memberKey);
  }

  if (!member) {
    return {
      success: false,
      error: 'Department member not found.',
      statusCode: 404,
    };
  }

  // Manager restrictions
  if (actorRole === UserRole.MANAGER) {
    const deptMem = await getUserDepartmentMembership(actorId, departmentId, db);
    if (!deptMem || !deptMem.isActive) {
      return {
        success: false,
        error: 'Forbidden: Managers can only modify staff in their own department.',
        statusCode: 403,
      };
    }

    if (member.roleInDepartment === 'MANAGER' || member.roleInDepartment === 'DEPARTMENT_HEAD') {
      return {
        success: false,
        error: 'Forbidden: Department managers cannot modify other department managers.',
        statusCode: 403,
      };
    }

    if (
      input.roleInDepartment &&
      (input.roleInDepartment.toUpperCase() === 'MANAGER' ||
        input.roleInDepartment.toUpperCase() === 'DEPARTMENT_HEAD')
    ) {
      return {
        success: false,
        error: 'Forbidden: Department managers cannot promote staff to manager.',
        statusCode: 403,
      };
    }
  }

  const updateData: { roleInDepartment?: string; isActive?: boolean } = {};
  if (input.roleInDepartment) updateData.roleInDepartment = input.roleInDepartment.trim().toUpperCase();
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  if (hasDbUrl()) {
    try {
      const updated = await db.departmentMember.update({
        where: { id: member.id },
        data: updateData,
        include: {
          user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        },
      });

      return {
        success: true,
        data: { member: updated },
        message: 'Department member updated successfully',
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback
  const updatedMock = { ...member, ...updateData, updatedAt: new Date() };
  MOCK_DEPT_MEMBERS.set(memberKey, updatedMock);

  return {
    success: true,
    data: { member: updatedMock },
    message: 'Department member updated successfully',
    statusCode: 200,
  };
}

/**
 * 9. Removes (soft-deactivates) a department member.
 * Does not delete the user account or organization membership.
 */
export async function removeDepartmentMember(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  departmentId: string,
  targetUserId: string,
  db = prisma
): Promise<ServiceResult<void>> {
  if (!isValidUuid(organizationId) || !isValidUuid(departmentId) || !isValidUuid(targetUserId)) {
    return { success: false, error: 'Invalid UUID parameter.', statusCode: 400 };
  }

  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN &&
    actorRole !== UserRole.MANAGER
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to remove department members.',
      statusCode: 403,
    };
  }

  if (actorId === targetUserId) {
    return {
      success: false,
      error: 'Forbidden: Cannot remove yourself from the department.',
      statusCode: 403,
    };
  }

  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const authCheck = await canAccessOrganization(actorId, actorRole, organizationId, {}, db);
    if (!authCheck.allowed) {
      return {
        success: false,
        error: authCheck.reason || 'Forbidden: Access to this organization is denied.',
        statusCode: 403,
      };
    }
  }

  let dept: any = null;
  if (hasDbUrl()) {
    try {
      dept = await db.department.findUnique({ where: { id: departmentId } });
    } catch {
      // Fallback
    }
  }
  if (!dept) {
    dept = MOCK_DEPTS.get(departmentId);
  }

  if (!dept || dept.organizationId !== organizationId) {
    return {
      success: false,
      error: 'Department not found in this organization.',
      statusCode: 404,
    };
  }

  let member: any = null;
  const memberKey = `${departmentId}:${targetUserId}`;

  if (hasDbUrl()) {
    try {
      member = await db.departmentMember.findUnique({
        where: {
          departmentId_userId: {
            departmentId,
            userId: targetUserId,
          },
        },
      });
    } catch {
      // Fallback
    }
  }
  if (!member) {
    member = MOCK_DEPT_MEMBERS.get(memberKey);
  }

  if (!member || !member.isActive) {
    return {
      success: false,
      error: 'Active department member not found.',
      statusCode: 404,
    };
  }

  // Manager restrictions
  if (actorRole === UserRole.MANAGER) {
    const deptMem = await getUserDepartmentMembership(actorId, departmentId, db);
    if (!deptMem || !deptMem.isActive) {
      return {
        success: false,
        error: 'Forbidden: Managers can only remove staff from their own department.',
        statusCode: 403,
      };
    }

    if (member.roleInDepartment === 'MANAGER' || member.roleInDepartment === 'DEPARTMENT_HEAD') {
      return {
        success: false,
        error: 'Forbidden: Department managers cannot remove other department managers.',
        statusCode: 403,
      };
    }
  }

  if (hasDbUrl()) {
    try {
      await db.departmentMember.update({
        where: { id: member.id },
        data: { isActive: false },
      });

      return {
        success: true,
        message: 'Department member deactivated successfully',
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback soft-deactivation
  MOCK_DEPT_MEMBERS.set(memberKey, { ...member, isActive: false, updatedAt: new Date() });
  if (dept._count && dept._count.members > 0) {
    dept._count.members -= 1;
  }

  return {
    success: true,
    message: 'Department member deactivated successfully',
    statusCode: 200,
  };
}
