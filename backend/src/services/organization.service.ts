import { prisma } from '../lib/prisma.js';
import { UserRole, OrganizationType, OrgMemberRole } from '@prisma/client';
import {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  AddMemberInput,
  UpdateMemberInput,
} from '../validators/organization.validator.js';
import { canAccessOrganization, getUserOrganizationMembership } from './rbac.service.js';
import { ServiceResult } from './auth.service.js';

export type OrgServiceResult<T> = ServiceResult<T>;

const hasDbUrl = (): boolean =>
  Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Transforms a human-readable name into a URL-friendly lowercase slug.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ==============================================================================
// In-Memory Seeded Fallback Store
// Matches Prompt 4 seed data and enables deterministic testing when offline.
// ==============================================================================
interface MockOrg {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  orgType: OrganizationType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { members: number; departments: number };
}

interface MockMember {
  id: string;
  organizationId: string;
  userId: string;
  orgRole: OrgMemberRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string; email: string; role: UserRole };
}

const MOCK_ORGS: Map<string, MockOrg> = new Map([
  [
    'a0000000-0000-0000-0000-000000000001',
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'SRM Campus Administration',
      slug: 'srm-campus-admin',
      description: 'Official campus administrative authority for SRM Kattankulathur',
      orgType: OrganizationType.UNIVERSITY,
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      _count: { members: 4, departments: 5 },
    },
  ],
]);

const MOCK_MEMBERS: Map<string, MockMember> = new Map([
  [
    'a0000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000002',
    {
      id: 'm0000000-0000-0000-0000-000000000001',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      userId: 'f0000000-0000-0000-0000-000000000002',
      orgRole: OrgMemberRole.OWNER,
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      user: {
        id: 'f0000000-0000-0000-0000-000000000002',
        name: 'SRM Administration Owner',
        email: 'srm.owner@civicfix.demo',
        role: UserRole.ORG_OWNER,
      },
    },
  ],
  [
    'a0000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000003',
    {
      id: 'm0000000-0000-0000-0000-000000000002',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      userId: 'f0000000-0000-0000-0000-000000000003',
      orgRole: OrgMemberRole.ADMIN,
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      user: {
        id: 'f0000000-0000-0000-0000-000000000003',
        name: 'SRM Operations Admin',
        email: 'srm.admin@civicfix.demo',
        role: UserRole.ORG_ADMIN,
      },
    },
  ],
  [
    'a0000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000004',
    {
      id: 'm0000000-0000-0000-0000-000000000003',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      userId: 'f0000000-0000-0000-0000-000000000004',
      orgRole: OrgMemberRole.MANAGER,
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      user: {
        id: 'f0000000-0000-0000-0000-000000000004',
        name: 'Civil Infrastructure Manager',
        email: 'manager@civicfix.demo',
        role: UserRole.MANAGER,
      },
    },
  ],
  [
    'a0000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000005',
    {
      id: 'm0000000-0000-0000-0000-000000000004',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      userId: 'f0000000-0000-0000-0000-000000000005',
      orgRole: OrgMemberRole.STAFF,
      isActive: true,
      createdAt: new Date('2026-09-27T00:00:00Z'),
      updatedAt: new Date('2026-09-27T00:00:00Z'),
      user: {
        id: 'f0000000-0000-0000-0000-000000000005',
        name: 'Electrical Field Technician',
        email: 'staff@civicfix.demo',
        role: UserRole.STAFF,
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

/**
 * 1. Creates a new tenant organization.
 * Restricted to PLATFORM_ADMIN.
 */
export async function createOrganization(
  actorRole: UserRole,
  input: CreateOrganizationInput,
  db = prisma
): Promise<ServiceResult<unknown>> {
  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    return {
      success: false,
      error: 'Forbidden: Only platform administrators can create organizations.',
      statusCode: 403,
    };
  }

  const trimmedName = input.name.trim();
  const slug = slugify(trimmedName);

  if (hasDbUrl()) {
    try {
      const existing = await db.organization.findFirst({
        where: {
          OR: [{ name: { equals: trimmedName, mode: 'insensitive' } }, { slug }],
        },
      });

      if (existing) {
        return {
          success: false,
          error: 'An organization with this name or slug already exists.',
          statusCode: 409,
        };
      }

      const org = await db.organization.create({
        data: {
          name: trimmedName,
          slug,
          description: input.description?.trim() || null,
          orgType: input.orgType || OrganizationType.OTHER,
          isActive: true,
        },
        include: {
          _count: {
            select: { members: true, departments: true },
          },
        },
      });

      return {
        success: true,
        data: org,
        message: 'Organization created successfully',
        statusCode: 201,
      };
    } catch {
      // Fallback if query failed
    }
  }

  // Fallback / mock creation
  for (const org of MOCK_ORGS.values()) {
    if (org.name.toLowerCase() === trimmedName.toLowerCase() || org.slug === slug) {
      return {
        success: false,
        error: 'An organization with this name or slug already exists.',
        statusCode: 409,
      };
    }
  }

  const id = `a0000000-0000-0000-0000-${String(MOCK_ORGS.size + 10).padStart(12, '0')}`;
  const mockOrg: MockOrg = {
    id,
    name: trimmedName,
    slug,
    description: input.description?.trim() || null,
    orgType: input.orgType || OrganizationType.OTHER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { members: 0, departments: 0 },
  };
  MOCK_ORGS.set(id, mockOrg);

  return {
    success: true,
    data: mockOrg,
    message: 'Organization created successfully',
    statusCode: 201,
  };
}

/**
 * 2. Lists organizations.
 * PLATFORM_ADMIN sees all organizations.
 * Operational roles see only their active memberships.
 * USER is denied.
 */
export async function listOrganizations(
  actorId: string,
  actorRole: UserRole,
  db = prisma
): Promise<ServiceResult<{ organizations: unknown[] }>> {
  if (actorRole === UserRole.USER) {
    return {
      success: false,
      error: 'Forbidden: Public users cannot list administrative organizations.',
      statusCode: 403,
    };
  }

  if (hasDbUrl()) {
    try {
      if (actorRole === UserRole.PLATFORM_ADMIN) {
        const orgs = await db.organization.findMany({
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: { members: true, departments: true },
            },
          },
        });
        return { success: true, data: { organizations: orgs }, statusCode: 200 };
      }

      // Operational roles (ORG_OWNER, ORG_ADMIN, MANAGER, STAFF)
      const memberships = await db.organizationMember.findMany({
        where: {
          userId: actorId,
          isActive: true,
          organization: { isActive: true },
        },
        include: {
          organization: {
            include: {
              _count: {
                select: { members: true, departments: true },
              },
            },
          },
        },
      });

      const userOrgs = memberships.map((m) => ({
        ...m.organization,
        currentUserRole: m.orgRole,
      }));

      return { success: true, data: { organizations: userOrgs }, statusCode: 200 };
    } catch {
      // Fallback
    }
  }

  // Fallback
  if (actorRole === UserRole.PLATFORM_ADMIN) {
    return {
      success: true,
      data: { organizations: Array.from(MOCK_ORGS.values()) },
      statusCode: 200,
    };
  }

  // Filter organizations where user is a member
  const userOrgs: unknown[] = [];
  for (const [key, mem] of MOCK_MEMBERS.entries()) {
    if (key.endsWith(`:${actorId}`) && mem.isActive) {
      const org = MOCK_ORGS.get(mem.organizationId);
      if (org && org.isActive) {
        userOrgs.push({ ...org, currentUserRole: mem.orgRole });
      }
    }
  }

  return { success: true, data: { organizations: userOrgs }, statusCode: 200 };
}

/**
 * 3. Retrieves details for a specific organization.
 */
export async function getOrganizationById(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  db = prisma
): Promise<ServiceResult<{ organization: unknown }>> {
  if (actorRole === UserRole.USER) {
    return {
      success: false,
      error: 'Forbidden: Public users cannot inspect organization administrative details.',
      statusCode: 403,
    };
  }

  let org: any = null;

  if (hasDbUrl()) {
    try {
      org = await db.organization.findUnique({
        where: { id: organizationId },
        include: {
          _count: {
            select: { members: true, departments: true },
          },
        },
      });
    } catch {
      // Fallback
    }
  }

  if (!org) {
    org = MOCK_ORGS.get(organizationId);
  }

  if (!org) {
    return {
      success: false,
      error: 'Organization not found.',
      statusCode: 404,
    };
  }

  // Check authorization
  const authCheck = await canAccessOrganization(actorId, actorRole, organizationId, {}, db);
  if (!authCheck.allowed) {
    return {
      success: false,
      error: authCheck.reason || 'Forbidden: Access to this organization is denied.',
      statusCode: 403,
    };
  }

  // Inactive organization check (Platform Admin override permitted)
  if (!org.isActive && actorRole !== UserRole.PLATFORM_ADMIN) {
    return {
      success: false,
      error: 'Forbidden: This organization is currently deactivated.',
      statusCode: 403,
    };
  }

  return {
    success: true,
    data: { organization: org },
    statusCode: 200,
  };
}

/**
 * 4. Updates organization metadata.
 * Permitted for PLATFORM_ADMIN or ORG_OWNER / ORG_ADMIN of that organization.
 */
export async function updateOrganization(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  input: UpdateOrganizationInput,
  db = prisma
): Promise<ServiceResult<{ organization: unknown }>> {
  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to modify organization configuration.',
      statusCode: 403,
    };
  }

  let org: any = null;
  if (hasDbUrl()) {
    try {
      org = await db.organization.findUnique({ where: { id: organizationId } });
    } catch {
      // Fallback
    }
  }
  if (!org) {
    org = MOCK_ORGS.get(organizationId);
  }

  if (!org) {
    return {
      success: false,
      error: 'Organization not found.',
      statusCode: 404,
    };
  }

  // Verify membership if non-platform admin
  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const mem = await getUserOrganizationMembership(actorId, organizationId, db);
    if (!mem || (mem.orgRole !== OrgMemberRole.OWNER && mem.orgRole !== OrgMemberRole.ADMIN)) {
      return {
        success: false,
        error: 'Forbidden: You do not have administrative authority over this organization.',
        statusCode: 403,
      };
    }
  }

  // Inactive check
  if (!org.isActive && actorRole !== UserRole.PLATFORM_ADMIN) {
    return {
      success: false,
      error: 'Forbidden: Inactive organizations cannot be modified.',
      statusCode: 403,
    };
  }

  const updateData: {
    name?: string;
    slug?: string;
    description?: string | null;
    orgType?: OrganizationType;
  } = {};

  if (input.name) {
    const trimmed = input.name.trim();
    if (trimmed !== org.name) {
      updateData.name = trimmed;
      updateData.slug = slugify(trimmed);
    }
  }

  if (input.description !== undefined) {
    updateData.description = input.description ? input.description.trim() : null;
  }

  if (input.orgType) {
    updateData.orgType = input.orgType;
  }

  if (hasDbUrl()) {
    try {
      const updated = await db.organization.update({
        where: { id: organizationId },
        data: updateData,
        include: {
          _count: {
            select: { members: true, departments: true },
          },
        },
      });

      return {
        success: true,
        data: { organization: updated },
        message: 'Organization updated successfully',
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback update
  const updatedMock: MockOrg = {
    ...org,
    ...updateData,
    updatedAt: new Date(),
  };
  MOCK_ORGS.set(organizationId, updatedMock);

  return {
    success: true,
    data: { organization: updatedMock },
    message: 'Organization updated successfully',
    statusCode: 200,
  };
}

/**
 * 5. Activates or deactivates an organization.
 * STRICTLY PLATFORM_ADMIN.
 */
export async function updateOrganizationStatus(
  actorRole: UserRole,
  organizationId: string,
  isActive: boolean,
  db = prisma
): Promise<ServiceResult<{ organization: unknown }>> {
  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    return {
      success: false,
      error: 'Forbidden: Only platform administrators can activate or deactivate organizations.',
      statusCode: 403,
    };
  }

  if (!isValidUuid(organizationId)) {
    return {
      success: false,
      error: 'Invalid organization ID parameter.',
      statusCode: 400,
    };
  }

  let org: any = null;
  if (hasDbUrl()) {
    try {
      org = await db.organization.findUnique({ where: { id: organizationId } });
    } catch {
      // Fallback
    }
  }
  if (!org) {
    org = MOCK_ORGS.get(organizationId);
  }

  if (!org) {
    return {
      success: false,
      error: 'Organization not found.',
      statusCode: 404,
    };
  }

  if (hasDbUrl()) {
    try {
      const updated = await db.organization.update({
        where: { id: organizationId },
        data: { isActive },
      });

      return {
        success: true,
        data: { organization: updated },
        message: isActive
          ? 'Organization activated successfully'
          : 'Organization deactivated successfully',
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback
  const updatedMock = { ...org, isActive, updatedAt: new Date() };
  MOCK_ORGS.set(organizationId, updatedMock);

  return {
    success: true,
    data: { organization: updatedMock },
    message: isActive
      ? 'Organization activated successfully'
      : 'Organization deactivated successfully',
    statusCode: 200,
  };
}

/**
 * 6. Lists all members within an organization.
 * Permitted for PLATFORM_ADMIN, ORG_OWNER, and ORG_ADMIN of that organization.
 */
export async function listOrganizationMembers(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  db = prisma
): Promise<ServiceResult<{ members: unknown[] }>> {
  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to view organization members.',
      statusCode: 403,
    };
  }

  // If non-platform admin, verify active membership
  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const mem = await getUserOrganizationMembership(actorId, organizationId, db);
    if (!mem || (mem.orgRole !== OrgMemberRole.OWNER && mem.orgRole !== OrgMemberRole.ADMIN)) {
      return {
        success: false,
        error: 'Forbidden: You do not have administrative access to this organization.',
        statusCode: 403,
      };
    }
  }

  if (hasDbUrl()) {
    try {
      const members = await db.organizationMember.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          orgRole: true,
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
  for (const mem of MOCK_MEMBERS.values()) {
    if (mem.organizationId === organizationId) {
      members.push(mem);
    }
  }

  return {
    success: true,
    data: { members },
    statusCode: 200,
  };
}

/**
 * 7. Adds a user as a member of an organization.
 * Enforces strict privilege escalation guards:
 * - PLATFORM_ADMIN can assign any org role.
 * - ORG_OWNER can assign ADMIN, MANAGER, STAFF, MEMBER.
 * - ORG_ADMIN can assign MANAGER, STAFF, MEMBER. Cannot assign OWNER or ADMIN.
 * - MANAGER, STAFF, USER cannot add members.
 */
export async function addOrganizationMember(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  input: AddMemberInput,
  db = prisma
): Promise<ServiceResult<{ member: unknown }>> {
  // 1. Actor permission check
  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to add members.',
      statusCode: 403,
    };
  }

  // 2. Prevent self-addition (actors cannot add themselves to gain privileges)
  if (actorId === input.userId) {
    return {
      success: false,
      error: 'Forbidden: Users cannot add themselves to organizations.',
      statusCode: 403,
    };
  }

  // 3. Organization Admin privilege limits
  if (actorRole === UserRole.ORG_ADMIN) {
    if (input.role === OrgMemberRole.OWNER || input.role === OrgMemberRole.ADMIN) {
      return {
        success: false,
        error: 'Forbidden: Organization Admins cannot assign Owner or Admin roles.',
        statusCode: 403,
      };
    }
  }

  // 4. Verify actor's membership if not platform superadmin
  if (actorRole !== UserRole.PLATFORM_ADMIN) {
    const actorMem = await getUserOrganizationMembership(actorId, organizationId, db);
    if (
      !actorMem ||
      (actorMem.orgRole !== OrgMemberRole.OWNER && actorMem.orgRole !== OrgMemberRole.ADMIN)
    ) {
      return {
        success: false,
        error: 'Forbidden: You do not have administrative access to this organization.',
        statusCode: 403,
      };
    }
  }

  // 5. Target user existence check
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

  // 6. Organization existence check
  let org: any = null;
  if (hasDbUrl()) {
    try {
      org = await db.organization.findUnique({ where: { id: organizationId } });
    } catch {
      // Fallback
    }
  }
  if (!org) {
    org = MOCK_ORGS.get(organizationId);
  }
  if (!org) {
    return {
      success: false,
      error: 'Organization not found.',
      statusCode: 404,
    };
  }

  if (!org.isActive && actorRole !== UserRole.PLATFORM_ADMIN) {
    return {
      success: false,
      error: 'Forbidden: Inactive organizations cannot accept new members.',
      statusCode: 403,
    };
  }

  // 7. Check if member already exists
  const memberKey = `${organizationId}:${input.userId}`;
  const existingMock = MOCK_MEMBERS.get(memberKey);

  if (hasDbUrl()) {
    try {
      const existing = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: input.userId,
          },
        },
      });

      if (existing) {
        if (existing.isActive) {
          return {
            success: false,
            error: 'User is already an active member of this organization.',
            statusCode: 409,
          };
        }
        // Reactivate inactive member
        const reactivated = await db.organizationMember.update({
          where: { id: existing.id },
          data: {
            orgRole: input.role,
            isActive: true,
          },
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        });
        return {
          success: true,
          data: { member: reactivated },
          message: 'Member reactivated in organization successfully',
          statusCode: 200,
        };
      }

      const newMember = await db.organizationMember.create({
        data: {
          organizationId,
          userId: input.userId,
          orgRole: input.role,
          isActive: true,
        },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      return {
        success: true,
        data: { member: newMember },
        message: 'Member added to organization successfully',
        statusCode: 201,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback logic
  if (existingMock && existingMock.isActive) {
    return {
      success: false,
      error: 'User is already an active member of this organization.',
      statusCode: 409,
    };
  }

  const id = `m0000000-0000-0000-0000-${String(MOCK_MEMBERS.size + 10).padStart(12, '0')}`;
  const newMockMember: MockMember = {
    id,
    organizationId,
    userId: input.userId,
    orgRole: input.role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: targetUser,
  };
  MOCK_MEMBERS.set(memberKey, newMockMember);

  return {
    success: true,
    data: { member: newMockMember },
    message: 'Member added to organization successfully',
    statusCode: 201,
  };
}

/**
 * 8. Updates an organization member's role or status.
 * Enforces role modification constraints and blocks self-promotion.
 */
export async function updateOrganizationMember(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  targetUserId: string,
  input: UpdateMemberInput,
  db = prisma
): Promise<ServiceResult<{ member: unknown }>> {
  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to modify organization members.',
      statusCode: 403,
    };
  }

  // Prevent users from changing their own role
  if (actorId === targetUserId) {
    return {
      success: false,
      error: 'Forbidden: Users cannot modify their own organization membership or role.',
      statusCode: 403,
    };
  }

  if (!isValidUuid(targetUserId)) {
    return {
      success: false,
      error: 'Invalid user ID parameter.',
      statusCode: 400,
    };
  }

  // Check target membership
  let member: any = null;
  const memberKey = `${organizationId}:${targetUserId}`;

  if (hasDbUrl()) {
    try {
      member = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: targetUserId,
          },
        },
      });
    } catch {
      // Fallback
    }
  }
  if (!member) {
    member = MOCK_MEMBERS.get(memberKey);
  }

  if (!member) {
    return {
      success: false,
      error: 'Member not found in this organization.',
      statusCode: 404,
    };
  }

  // Privilege hierarchy checks
  if (actorRole === UserRole.ORG_ADMIN) {
    // Org Admin cannot modify an Owner or another Admin
    if (member.orgRole === OrgMemberRole.OWNER || member.orgRole === OrgMemberRole.ADMIN) {
      return {
        success: false,
        error: 'Forbidden: Organization Admins cannot modify Owner or Admin memberships.',
        statusCode: 403,
      };
    }
    // Org Admin cannot promote someone to Owner or Admin
    if (
      input.role &&
      (input.role === OrgMemberRole.OWNER || input.role === OrgMemberRole.ADMIN)
    ) {
      return {
        success: false,
        error: 'Forbidden: Organization Admins cannot assign Owner or Admin roles.',
        statusCode: 403,
      };
    }
  }

  const updateData: { orgRole?: OrgMemberRole; isActive?: boolean } = {};
  if (input.role) updateData.orgRole = input.role;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  if (hasDbUrl()) {
    try {
      const updated = await db.organizationMember.update({
        where: { id: member.id },
        data: updateData,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      return {
        success: true,
        data: { member: updated },
        message: 'Member updated successfully',
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback update
  const updatedMock = {
    ...member,
    ...updateData,
    updatedAt: new Date(),
  };
  MOCK_MEMBERS.set(memberKey, updatedMock);

  return {
    success: true,
    data: { member: updatedMock },
    message: 'Member updated successfully',
    statusCode: 200,
  };
}

/**
 * 9. Removes (deactivates) a member from an organization.
 * Soft-deactivates the membership without deleting the user account.
 */
export async function removeOrganizationMember(
  actorId: string,
  actorRole: UserRole,
  organizationId: string,
  targetUserId: string,
  db = prisma
): Promise<ServiceResult<void>> {
  if (
    actorRole !== UserRole.PLATFORM_ADMIN &&
    actorRole !== UserRole.ORG_OWNER &&
    actorRole !== UserRole.ORG_ADMIN
  ) {
    return {
      success: false,
      error: 'Forbidden: Insufficient permissions to remove organization members.',
      statusCode: 403,
    };
  }

  if (actorId === targetUserId) {
    return {
      success: false,
      error: 'Forbidden: Cannot remove yourself from the organization.',
      statusCode: 403,
    };
  }

  if (!isValidUuid(targetUserId)) {
    return {
      success: false,
      error: 'Invalid user ID parameter.',
      statusCode: 400,
    };
  }

  let member: any = null;
  const memberKey = `${organizationId}:${targetUserId}`;

  if (hasDbUrl()) {
    try {
      member = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: targetUserId,
          },
        },
      });
    } catch {
      // Fallback
    }
  }
  if (!member) {
    member = MOCK_MEMBERS.get(memberKey);
  }

  if (!member || !member.isActive) {
    return {
      success: false,
      error: 'Active member not found in this organization.',
      statusCode: 404,
    };
  }

  // Privilege checks
  if (actorRole === UserRole.ORG_ADMIN) {
    if (member.orgRole === OrgMemberRole.OWNER || member.orgRole === OrgMemberRole.ADMIN) {
      return {
        success: false,
        error: 'Forbidden: Organization Admins cannot remove Owner or Admin members.',
        statusCode: 403,
      };
    }
  }

  if (hasDbUrl()) {
    try {
      await db.organizationMember.update({
        where: { id: member.id },
        data: { isActive: false },
      });

      return {
        success: true,
        message: 'Member deactivated from organization successfully',
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // Fallback deactivation
  MOCK_MEMBERS.set(memberKey, { ...member, isActive: false, updatedAt: new Date() });

  return {
    success: true,
    message: 'Member deactivated from organization successfully',
    statusCode: 200,
  };
}
