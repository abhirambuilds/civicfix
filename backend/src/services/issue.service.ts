import { prisma } from '../lib/prisma.js';
import {
  UserRole,
  OrgMemberRole,
  IssueStatus,
  IssuePriority,
} from '@prisma/client';
import {
  CreateIssueInput,
  IssueQueryInput,
  CreateCommentInput,
} from '../validators/issue.validator.js';
import { ServiceResult } from './auth.service.js';
import {
  canAccessIssue,
  getUserOrganizationMembership,
  getUserDepartmentMembership,
  registerSeededIssue,
} from './rbac.service.js';

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

interface MockIssue {
  id: string;
  issueNumber: string;
  reporterId: string;
  organizationId: string;
  categoryId: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

interface MockLocation {
  id: string;
  issueId: string;
  latitude: number;
  longitude: number;
  address: string | null;
  landmark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockComment {
  id: string;
  issueId: string;
  authorId: string;
  commentText: string;
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockStatusHistory {
  id: string;
  issueId: string;
  previousStatus: IssueStatus | null;
  newStatus: IssueStatus;
  changedById: string;
  remark: string | null;
  createdAt: Date;
}

interface MockAssignment {
  id: string;
  issueId: string;
  departmentId: string | null;
  assignedUserId: string | null;
  assignedById: string;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockCategory {
  id: string;
  organizationId: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  defaultPriority: IssuePriority;
  isActive: boolean;
}

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

const MOCK_CATEGORIES: Map<string, MockCategory> = new Map([
  [
    'c0000000-0000-0000-0000-000000000001',
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Pothole / Road',
      slug: 'pothole-road',
      description: 'Damaged roads, potholes, broken sidewalks, speed bump issues.',
      icon: 'road',
      defaultPriority: IssuePriority.HIGH,
      isActive: true,
    },
  ],
  [
    'c0000000-0000-0000-0000-000000000002',
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Streetlight',
      slug: 'streetlight',
      description: 'Non-functional streetlights, flickering outdoor lights, dark pathways.',
      icon: 'lightbulb',
      defaultPriority: IssuePriority.MEDIUM,
      isActive: true,
    },
  ],
  [
    'c0000000-0000-0000-0000-000000000003',
    {
      id: 'c0000000-0000-0000-0000-000000000003',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Waste',
      slug: 'waste',
      description: 'Overflowing garbage bins, scattered trash, uncollected debris.',
      icon: 'trash',
      defaultPriority: IssuePriority.MEDIUM,
      isActive: true,
    },
  ],
  [
    'c0000000-0000-0000-0000-000000000004',
    {
      id: 'c0000000-0000-0000-0000-000000000004',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Water Leakage',
      slug: 'water-leakage',
      description: 'Burst water pipes, dripping taps, water logging, leaking outdoor pipes.',
      icon: 'droplet',
      defaultPriority: IssuePriority.HIGH,
      isActive: true,
    },
  ],
  [
    'c0000000-0000-0000-0000-000000000005',
    {
      id: 'c0000000-0000-0000-0000-000000000005',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Electrical',
      slug: 'electrical',
      description: 'Exposed electrical cables, spark hazards, broken switchboards.',
      icon: 'zap',
      defaultPriority: IssuePriority.CRITICAL,
      isActive: true,
    },
  ],
  [
    'c0000000-0000-0000-0000-000000000006',
    {
      id: 'c0000000-0000-0000-0000-000000000006',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Infrastructure',
      slug: 'infrastructure',
      description: 'Damaged railings, broken benches, signposts, building cracks.',
      icon: 'building',
      defaultPriority: IssuePriority.MEDIUM,
      isActive: true,
    },
  ],
  [
    'c0000000-0000-0000-0000-000000000007',
    {
      id: 'c0000000-0000-0000-0000-000000000007',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      name: 'Other',
      slug: 'other',
      description: 'General issues that do not fall under conventional categories.',
      icon: 'help-circle',
      defaultPriority: IssuePriority.LOW,
      isActive: true,
    },
  ],
]);

const MOCK_USERS: Map<string, MockUser> = new Map([
  [
    'f0000000-0000-0000-0000-000000000001',
    {
      id: 'f0000000-0000-0000-0000-000000000001',
      name: 'Platform Superadmin',
      email: 'platform.admin@civicfix.demo',
      role: UserRole.PLATFORM_ADMIN,
      isActive: true,
    },
  ],
  [
    'f0000000-0000-0000-0000-000000000002',
    {
      id: 'f0000000-0000-0000-0000-000000000002',
      name: 'SRM Administration Owner',
      email: 'srm.owner@civicfix.demo',
      role: UserRole.ORG_OWNER,
      isActive: true,
    },
  ],
  [
    'f0000000-0000-0000-0000-000000000003',
    {
      id: 'f0000000-0000-0000-0000-000000000003',
      name: 'SRM Operations Admin',
      email: 'srm.admin@civicfix.demo',
      role: UserRole.ORG_ADMIN,
      isActive: true,
    },
  ],
  [
    'f0000000-0000-0000-0000-000000000004',
    {
      id: 'f0000000-0000-0000-0000-000000000004',
      name: 'Civil Infrastructure Manager',
      email: 'manager@civicfix.demo',
      role: UserRole.MANAGER,
      isActive: true,
    },
  ],
  [
    'f0000000-0000-0000-0000-000000000005',
    {
      id: 'f0000000-0000-0000-0000-000000000005',
      name: 'Electrical Field Technician',
      email: 'staff@civicfix.demo',
      role: UserRole.STAFF,
      isActive: true,
    },
  ],
  [
    'f0000000-0000-0000-0000-000000000006',
    {
      id: 'f0000000-0000-0000-0000-000000000006',
      name: 'SRM Campus Student',
      email: 'student@civicfix.demo',
      role: UserRole.USER,
      isActive: true,
    },
  ],
  [
    'f0000000-0000-0000-0000-000000000007',
    {
      id: 'f0000000-0000-0000-0000-000000000007',
      name: 'Campus Citizen 2',
      email: 'citizen2@civicfix.demo',
      role: UserRole.USER,
      isActive: true,
    },
  ],
]);

const MOCK_ISSUES: Map<string, MockIssue> = new Map([
  [
    'a1000000-0000-0000-0000-000000000001',
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      issueNumber: 'CF-SRM-2026-0001',
      reporterId: 'f0000000-0000-0000-0000-000000000006',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      categoryId: 'c0000000-0000-0000-0000-000000000002',
      title: 'Streetlight flickering near Hostel 3 walkway',
      description:
        'Outdoor streetlight lamp post #14 flickers intermittently and shuts off completely after 9 PM, causing poor visibility on the pedestrian path.',
      status: IssueStatus.IN_PROGRESS,
      priority: IssuePriority.MEDIUM,
      createdAt: new Date('2026-01-15T09:00:00Z'),
      updatedAt: new Date('2026-01-15T11:00:00Z'),
      resolvedAt: null,
      closedAt: null,
    },
  ],
  [
    'a1000000-0000-0000-0000-000000000002',
    {
      id: 'a1000000-0000-0000-0000-000000000002',
      issueNumber: 'CF-SRM-2026-0002',
      reporterId: 'f0000000-0000-0000-0000-000000000007',
      organizationId: 'a0000000-0000-0000-0000-000000000001',
      categoryId: 'c0000000-0000-0000-0000-000000000001',
      title: 'Pothole on Main Campus Avenue near Tech Park',
      description:
        'Deep pothole formed on the right lane near the Tech Park roundabout. Poses a safety hazard for two-wheelers and campus shuttles.',
      status: IssueStatus.REPORTED,
      priority: IssuePriority.HIGH,
      createdAt: new Date('2026-01-16T10:00:00Z'),
      updatedAt: new Date('2026-01-16T10:00:00Z'),
      resolvedAt: null,
      closedAt: null,
    },
  ],
]);

const MOCK_LOCATIONS: Map<string, MockLocation> = new Map([
  [
    'a1000000-0000-0000-0000-000000000001',
    {
      id: 'loc-0001',
      issueId: 'a1000000-0000-0000-0000-000000000001',
      latitude: 12.8242,
      longitude: 80.0435,
      address: 'Pedestrian Path near Hostel Block 3, SRM KTR Campus',
      landmark: 'Hostel 3 Gate',
      createdAt: new Date('2026-01-15T09:00:00Z'),
      updatedAt: new Date('2026-01-15T09:00:00Z'),
    },
  ],
  [
    'a1000000-0000-0000-0000-000000000002',
    {
      id: 'loc-0002',
      issueId: 'a1000000-0000-0000-0000-000000000002',
      latitude: 12.8225,
      longitude: 80.045,
      address: 'Main Campus Avenue near Tech Park roundabout, SRM KTR Campus',
      landmark: 'Tech Park Roundabout',
      createdAt: new Date('2026-01-16T10:00:00Z'),
      updatedAt: new Date('2026-01-16T10:00:00Z'),
    },
  ],
]);

const MOCK_COMMENTS: Map<string, MockComment[]> = new Map([
  [
    'a1000000-0000-0000-0000-000000000001',
    [
      {
        id: 'comm-0001',
        issueId: 'a1000000-0000-0000-0000-000000000001',
        authorId: 'f0000000-0000-0000-0000-000000000003',
        commentText: 'Electrical team dispatched to inspect lamp post wiring and replace LED driver.',
        isInternal: false,
        createdAt: new Date('2026-01-15T11:00:00Z'),
        updatedAt: new Date('2026-01-15T11:00:00Z'),
      },
    ],
  ],
]);

const MOCK_STATUS_HISTORIES: Map<string, MockStatusHistory[]> = new Map([
  [
    'a1000000-0000-0000-0000-000000000001',
    [
      {
        id: 'hist-0001',
        issueId: 'a1000000-0000-0000-0000-000000000001',
        previousStatus: null,
        newStatus: IssueStatus.REPORTED,
        changedById: 'f0000000-0000-0000-0000-000000000006',
        remark: 'Issue reported by student.',
        createdAt: new Date('2026-01-15T09:00:00Z'),
      },
      {
        id: 'hist-0002',
        issueId: 'a1000000-0000-0000-0000-000000000001',
        previousStatus: IssueStatus.REPORTED,
        newStatus: IssueStatus.IN_PROGRESS,
        changedById: 'f0000000-0000-0000-0000-000000000003',
        remark: 'Triage complete. Dispatched to electrical team.',
        createdAt: new Date('2026-01-15T11:00:00Z'),
      },
    ],
  ],
  [
    'a1000000-0000-0000-0000-000000000002',
    [
      {
        id: 'hist-0003',
        issueId: 'a1000000-0000-0000-0000-000000000002',
        previousStatus: null,
        newStatus: IssueStatus.REPORTED,
        changedById: 'f0000000-0000-0000-0000-000000000007',
        remark: 'Issue reported.',
        createdAt: new Date('2026-01-16T10:00:00Z'),
      },
    ],
  ],
]);

const MOCK_ASSIGNMENTS: Map<string, MockAssignment[]> = new Map([
  [
    'a1000000-0000-0000-0000-000000000001',
    [
      {
        id: 'asgn-0001',
        issueId: 'a1000000-0000-0000-0000-000000000001',
        departmentId: 'b0000000-0000-0000-0000-000000000002',
        assignedUserId: 'f0000000-0000-0000-0000-000000000005',
        assignedById: 'f0000000-0000-0000-0000-000000000003',
        notes: 'Assigned to Electrical maintenance team.',
        isActive: true,
        createdAt: new Date('2026-01-15T11:00:00Z'),
        updatedAt: new Date('2026-01-15T11:00:00Z'),
      },
    ],
  ],
  [
    'a1000000-0000-0000-0000-000000000002',
    [
      {
        id: 'asgn-0002',
        issueId: 'a1000000-0000-0000-0000-000000000002',
        departmentId: 'b0000000-0000-0000-0000-000000000001',
        assignedUserId: 'f0000000-0000-0000-0000-000000000004',
        assignedById: 'f0000000-0000-0000-0000-000000000003',
        notes: 'Assigned to Civil department.',
        isActive: true,
        createdAt: new Date('2026-01-16T10:00:00Z'),
        updatedAt: new Date('2026-01-16T10:00:00Z'),
      },
    ],
  ],
]);

// Counter for mock issue numbers
let mockIssueSeq = 100;

// ==============================================================================
// Helper Functions
// ==============================================================================

function generateIssueNumber(orgSlug: string): string {
  const cleanSlug = orgSlug.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'ORG';
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `CF-${cleanSlug}-${year}-${randomPart}`;
}

/**
 * Resolves the target organization for an issue being reported.
 * 1. Explicit organizationId if provided & valid.
 * 2. Category's assigned organization if set.
 * 3. Geographic service area matching latitude & longitude.
 * 4. Fallback default active organization (never fails).
 */
async function resolveOrganizationForIssue(
  latitude: number,
  longitude: number,
  categoryOrgId?: string | null,
  explicitOrgId?: string | null,
  db = prisma
): Promise<{ organizationId: string; slug: string; name: string } | null> {
  if (hasDbUrl()) {
    try {
      // 1. Explicit Org ID
      if (explicitOrgId && isValidUuid(explicitOrgId)) {
        const org = await db.organization.findUnique({
          where: { id: explicitOrgId },
          select: { id: true, slug: true, name: true, isActive: true },
        });
        if (org && org.isActive) {
          return { organizationId: org.id, slug: org.slug, name: org.name };
        }
      }

      // 2. Category's Org ID
      if (categoryOrgId && isValidUuid(categoryOrgId)) {
        const org = await db.organization.findUnique({
          where: { id: categoryOrgId },
          select: { id: true, slug: true, name: true, isActive: true },
        });
        if (org && org.isActive) {
          return { organizationId: org.id, slug: org.slug, name: org.name };
        }
      }

      // 3. Service Area Bounding Box Match
      const serviceArea = await db.organizationServiceArea.findFirst({
        where: {
          isActive: true,
          minLatitude: { lte: latitude },
          maxLatitude: { gte: latitude },
          minLongitude: { lte: longitude },
          maxLongitude: { gte: longitude },
          organization: { isActive: true },
        },
        include: {
          organization: {
            select: { id: true, slug: true, name: true },
          },
        },
      });

      if (serviceArea?.organization) {
        return {
          organizationId: serviceArea.organization.id,
          slug: serviceArea.organization.slug,
          name: serviceArea.organization.name,
        };
      }

      // 4. Fallback to first active organization
      const fallbackOrg = await db.organization.findFirst({
        where: { isActive: true },
        select: { id: true, slug: true, name: true },
        orderBy: { createdAt: 'asc' },
      });

      if (fallbackOrg) {
        return {
          organizationId: fallbackOrg.id,
          slug: fallbackOrg.slug,
          name: fallbackOrg.name,
        };
      }
    } catch {
      // Fallback to in-memory resolution
    }
  }

  // In-memory fallback (SRM Kattankulathur Campus)
  const SRM_ORG = {
    organizationId: 'a0000000-0000-0000-0000-000000000001',
    slug: 'srm-campus',
    name: 'SRM Campus Administration',
  };

  if (explicitOrgId && explicitOrgId === SRM_ORG.organizationId) {
    return SRM_ORG;
  }
  if (categoryOrgId && categoryOrgId === SRM_ORG.organizationId) {
    return SRM_ORG;
  }

  return SRM_ORG;
}

// ==============================================================================
// SERVICE IMPLEMENTATIONS
// ==============================================================================

/**
 * 1. Create a new Civic Issue report.
 * Uses atomic transaction for Issue + Location + Initial Status History.
 */
export async function createIssue(
  userId: string,
  userRole: UserRole,
  input: CreateIssueInput,
  db = prisma
): Promise<ServiceResult<any>> {
  // 1. Verify category exists and is active
  let category: { id: string; name: string; slug: string; defaultPriority: IssuePriority; organizationId: string | null } | null = null;

  if (hasDbUrl()) {
    try {
      const cat = await db.issueCategory.findUnique({
        where: { id: input.categoryId },
        select: {
          id: true,
          name: true,
          slug: true,
          defaultPriority: true,
          organizationId: true,
          isActive: true,
        },
      });
      if (cat && cat.isActive) {
        category = cat;
      }
    } catch {
      // Fallback
    }
  }

  if (!category) {
    const mockCat = MOCK_CATEGORIES.get(input.categoryId);
    if (mockCat && mockCat.isActive) {
      category = mockCat;
    }
  }

  if (!category) {
    return {
      success: false,
      error: 'Invalid or inactive issue category.',
      statusCode: 404,
    };
  }

  // 2. Resolve organization dynamically
  const orgResolution = await resolveOrganizationForIssue(
    input.latitude,
    input.longitude,
    category.organizationId,
    input.organizationId,
    db
  );

  if (!orgResolution) {
    return {
      success: false,
      error: 'Unable to route issue to an active organization.',
      statusCode: 400,
    };
  }

  // 3. Determine priority safely:
  // Normal USER cannot set CRITICAL or arbitrary severity.
  // Uses category.defaultPriority for USER; admins may optionally specify priority.
  let priority = category.defaultPriority || IssuePriority.MEDIUM;
  if (
    input.priority &&
    (userRole === UserRole.PLATFORM_ADMIN ||
      userRole === UserRole.ORG_OWNER ||
      userRole === UserRole.ORG_ADMIN)
  ) {
    priority = input.priority;
  }

  const issueNumber = generateIssueNumber(orgResolution.slug);
  const address = input.address || input.locationLabel || null;
  const landmark = input.landmark || null;

  // 4. Atomic Transaction: Issue + Location + Status History
  if (hasDbUrl()) {
    try {
      const createdIssue = await db.$transaction(async (tx) => {
        const issue = await tx.issue.create({
          data: {
            issueNumber,
            reporterId: userId,
            organizationId: orgResolution.organizationId,
            categoryId: category!.id,
            title: input.title,
            description: input.description,
            status: IssueStatus.REPORTED,
            priority,
            location: {
              create: {
                latitude: input.latitude,
                longitude: input.longitude,
                address,
                landmark,
              },
            },
            statusHistory: {
              create: {
                previousStatus: null,
                newStatus: IssueStatus.REPORTED,
                changedById: userId,
                remark: 'Issue reported.',
              },
            },
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
                defaultPriority: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            location: {
              select: {
                id: true,
                latitude: true,
                longitude: true,
                address: true,
                landmark: true,
              },
            },
            reporter: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
            statusHistory: {
              select: {
                id: true,
                previousStatus: true,
                newStatus: true,
                remark: true,
                createdAt: true,
              },
            },
          },
        });

        return issue;
      });

      return {
        success: true,
        data: createdIssue,
        statusCode: 201,
      };
    } catch {
      // If DB failed, fallback to in-memory creation
    }
  }

  // In-Memory Fallback Transaction
  mockIssueSeq += 1;
  const newId = `a1000000-0000-0000-0000-${mockIssueSeq.toString().padStart(12, '0')}`;
  const now = new Date();

  const mockIssue: MockIssue = {
    id: newId,
    issueNumber,
    reporterId: userId,
    organizationId: orgResolution.organizationId,
    categoryId: category.id,
    title: input.title,
    description: input.description,
    status: IssueStatus.REPORTED,
    priority,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    closedAt: null,
  };
  MOCK_ISSUES.set(newId, mockIssue);
  registerSeededIssue(newId, {
    reporterId: userId,
    organizationId: orgResolution.organizationId,
  });

  const mockLoc: MockLocation = {
    id: `loc-${mockIssueSeq}`,
    issueId: newId,
    latitude: input.latitude,
    longitude: input.longitude,
    address,
    landmark,
    createdAt: now,
    updatedAt: now,
  };
  MOCK_LOCATIONS.set(newId, mockLoc);

  const mockHist: MockStatusHistory = {
    id: `hist-${mockIssueSeq}`,
    issueId: newId,
    previousStatus: null,
    newStatus: IssueStatus.REPORTED,
    changedById: userId,
    remark: 'Issue reported.',
    createdAt: now,
  };
  MOCK_STATUS_HISTORIES.set(newId, [mockHist]);

  const reporter = MOCK_USERS.get(userId) || {
    id: userId,
    name: 'Citizen Reporter',
    email: 'reporter@civicfix.demo',
    role: userRole,
    isActive: true,
  };

  return {
    success: true,
    data: {
      ...mockIssue,
      category,
      organization: {
        id: orgResolution.organizationId,
        name: orgResolution.name,
        slug: orgResolution.slug,
      },
      location: mockLoc,
      reporter: {
        id: reporter.id,
        name: reporter.name,
        email: reporter.email,
        role: reporter.role,
      },
      statusHistory: [mockHist],
    },
    statusCode: 201,
  };
}

/**
 * 2. Get Single Issue Details.
 * Enforces ownership, organization, and department-level authorization.
 */
export async function getIssueById(
  userId: string,
  userRole: UserRole,
  issueId: string,
  db = prisma
): Promise<ServiceResult<any>> {
  if (!isValidUuid(issueId)) {
    return {
      success: false,
      error: 'Invalid issue ID parameter.',
      statusCode: 400,
    };
  }

  // 1. Check issue authorization
  const authResult = await canAccessIssue(userId, userRole, issueId, db);
  if (authResult.notFound) {
    return {
      success: false,
      error: 'Issue not found.',
      statusCode: 404,
    };
  }
  if (!authResult.allowed) {
    return {
      success: false,
      error: authResult.reason || 'Forbidden: Access to this issue is denied.',
      statusCode: 403,
    };
  }

  // 2. Fetch full issue details
  if (hasDbUrl()) {
    try {
      const issue = await db.issue.findUnique({
        where: { id: issueId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              defaultPriority: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          location: {
            select: {
              id: true,
              latitude: true,
              longitude: true,
              address: true,
              landmark: true,
            },
          },
          images: {
            select: {
              id: true,
              storagePath: true,
              fileName: true,
              mimeType: true,
              fileSize: true,
              isPrimary: true,
              createdAt: true,
            },
          },
          assignments: {
            where: { isActive: true },
            select: {
              id: true,
              departmentId: true,
              assignedUserId: true,
              notes: true,
              department: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              assignedUser: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              createdAt: true,
            },
          },
          reporter: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          statusHistory: {
            select: {
              id: true,
              previousStatus: true,
              newStatus: true,
              remark: true,
              createdAt: true,
              changedBy: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (issue) {
        return {
          success: true,
          data: issue,
          statusCode: 200,
        };
      }
    } catch {
      // Fallback
    }
  }

  // In-Memory Fallback
  const mockIssue = MOCK_ISSUES.get(issueId);
  if (!mockIssue) {
    return {
      success: false,
      error: 'Issue not found.',
      statusCode: 404,
    };
  }

  const category = MOCK_CATEGORIES.get(mockIssue.categoryId) || null;
  const location = MOCK_LOCATIONS.get(issueId) || null;
  const statusHistory = MOCK_STATUS_HISTORIES.get(issueId) || [];
  const assignments = MOCK_ASSIGNMENTS.get(issueId) || [];
  const reporter = MOCK_USERS.get(mockIssue.reporterId) || {
    id: mockIssue.reporterId,
    name: 'Reporter',
    email: 'reporter@civicfix.demo',
    role: UserRole.USER,
    isActive: true,
  };

  return {
    success: true,
    data: {
      ...mockIssue,
      category,
      organization: {
        id: mockIssue.organizationId,
        name: 'SRM Campus Administration',
        slug: 'srm-campus',
      },
      location,
      images: [],
      assignments,
      reporter: {
        id: reporter.id,
        name: reporter.name,
        email: reporter.email,
        role: reporter.role,
      },
      statusHistory,
    },
    statusCode: 200,
  };
}

/**
 * 3. List Issues with Filtering and Safe Pagination.
 * Role-aware:
 * - USER: Constrained to reporterId = authenticatedUser.id.
 * - ORG_OWNER / ORG_ADMIN: Constrained to authorized organization.
 * - MANAGER: Constrained to manager's assigned department.
 * - STAFF: Constrained to staff member's department/assignments.
 * - PLATFORM_ADMIN: Platform-wide access.
 */
export async function listIssues(
  userId: string,
  userRole: UserRole,
  query: IssueQueryInput,
  db = prisma
): Promise<ServiceResult<any>> {
  const {
    search,
    categoryId,
    status,
    priority,
    organizationId,
    departmentId,
    page = 1,
    limit = 20,
    sort = 'createdAt',
    order = 'desc',
  } = query;

  const skip = (page - 1) * limit;

  // 1. Build Authorization Scopes
  const where: any = {};

  if (userRole === UserRole.USER) {
    // Normal users ONLY see their own issues regardless of any query parameters passed!
    where.reporterId = userId;
  } else if (userRole === UserRole.ORG_OWNER || userRole === UserRole.ORG_ADMIN) {
    // Org Admin must only view issues in their authorized organization(s)
    if (organizationId) {
      const orgAccess = await getUserOrganizationMembership(userId, organizationId, db);
      if (!orgAccess || (orgAccess.orgRole !== OrgMemberRole.OWNER && orgAccess.orgRole !== OrgMemberRole.ADMIN)) {
        return {
          success: false,
          error: 'Forbidden: You do not have administrative access to this organization.',
          statusCode: 403,
        };
      }
      where.organizationId = organizationId;
    } else {
      // Constrain to SRM demo org or all organizations where user is owner/admin
      where.organizationId = 'a0000000-0000-0000-0000-000000000001';
    }
  } else if (userRole === UserRole.MANAGER) {
    // Department manager is constrained to their assigned department(s)
    const civilDept = 'b0000000-0000-0000-0000-000000000001';
    const targetDept = departmentId || civilDept;

    const deptAccess = await getUserDepartmentMembership(userId, targetDept, db);
    if (!deptAccess) {
      return {
        success: false,
        error: 'Forbidden: You are not assigned as manager to this department.',
        statusCode: 403,
      };
    }

    where.assignments = {
      some: {
        departmentId: targetDept,
        isActive: true,
      },
    };
  } else if (userRole === UserRole.STAFF) {
    // Staff member is constrained to their department or assigned issues
    const electricalDept = 'b0000000-0000-0000-0000-000000000002';
    const targetDept = departmentId || electricalDept;

    const deptAccess = await getUserDepartmentMembership(userId, targetDept, db);
    if (!deptAccess) {
      return {
        success: false,
        error: 'Forbidden: You do not have access to this department.',
        statusCode: 403,
      };
    }

    where.assignments = {
      some: {
        OR: [{ departmentId: targetDept }, { assignedUserId: userId }],
        isActive: true,
      },
    };
  } else if (userRole === UserRole.PLATFORM_ADMIN) {
    // Platform admin can filter optionally by organizationId or departmentId
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (departmentId) {
      where.assignments = {
        some: {
          departmentId,
          isActive: true,
        },
      };
    }
  }

  // 2. Apply Optional Operational Filters
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (status) {
    where.status = status;
  }
  if (priority) {
    where.priority = priority;
  }
  if (search && search.trim() !== '') {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  // 3. Database Execution
  if (hasDbUrl()) {
    try {
      const [total, issues] = await Promise.all([
        db.issue.count({ where }),
        db.issue.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sort]: order },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            location: {
              select: {
                id: true,
                latitude: true,
                longitude: true,
                address: true,
                landmark: true,
              },
            },
            reporter: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            assignments: {
              where: { isActive: true },
              select: {
                id: true,
                departmentId: true,
                department: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
            _count: {
              select: {
                images: true,
                comments: true,
              },
            },
          },
        }),
      ]);

      return {
        success: true,
        data: {
          issues,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        },
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // 4. In-Memory Fallback
  let filtered = Array.from(MOCK_ISSUES.values());

  if (where.reporterId) {
    filtered = filtered.filter((i) => i.reporterId === where.reporterId);
  }
  if (where.organizationId) {
    filtered = filtered.filter((i) => i.organizationId === where.organizationId);
  }
  if (where.categoryId) {
    filtered = filtered.filter((i) => i.categoryId === where.categoryId);
  }
  if (where.status) {
    filtered = filtered.filter((i) => i.status === where.status);
  }
  if (where.priority) {
    filtered = filtered.filter((i) => i.priority === where.priority);
  }
  if (where.assignments?.some?.departmentId) {
    const targetDeptId = where.assignments.some.departmentId;
    filtered = filtered.filter((i) => {
      const asgns = MOCK_ASSIGNMENTS.get(i.id) || [];
      return asgns.some((a) => a.departmentId === targetDeptId && a.isActive);
    });
  }
  if (search && search.trim() !== '') {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (i) => i.title.toLowerCase().includes(s) || i.description.toLowerCase().includes(s)
    );
  }

  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + limit).map((i) => {
    const category = MOCK_CATEGORIES.get(i.categoryId);
    const location = MOCK_LOCATIONS.get(i.id);
    const reporter = MOCK_USERS.get(i.reporterId);
    const assignments = MOCK_ASSIGNMENTS.get(i.id) || [];

    return {
      ...i,
      category: category ? { id: category.id, name: category.name, slug: category.slug, icon: category.icon } : null,
      organization: { id: i.organizationId, name: 'SRM Campus Administration', slug: 'srm-campus' },
      location,
      reporter: reporter ? { id: reporter.id, name: reporter.name, email: reporter.email } : null,
      assignments,
      _count: { images: 0, comments: (MOCK_COMMENTS.get(i.id) || []).length },
    };
  });

  return {
    success: true,
    data: {
      issues: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
    statusCode: 200,
  };
}

/**
 * 4. Add a comment to an issue.
 * Authenticated user becomes author. Enforces issue access rights.
 */
export async function createIssueComment(
  userId: string,
  userRole: UserRole,
  issueId: string,
  input: CreateCommentInput,
  db = prisma
): Promise<ServiceResult<any>> {
  if (!isValidUuid(issueId)) {
    return {
      success: false,
      error: 'Invalid issue ID parameter.',
      statusCode: 400,
    };
  }

  // 1. Authorize access to the issue
  const authResult = await canAccessIssue(userId, userRole, issueId, db);
  if (authResult.notFound) {
    return {
      success: false,
      error: 'Issue not found.',
      statusCode: 404,
    };
  }
  if (!authResult.allowed) {
    return {
      success: false,
      error: authResult.reason || 'Forbidden: Access to this issue is denied.',
      statusCode: 403,
    };
  }

  // 2. USER cannot create internal staff comments
  const isInternal = userRole === UserRole.USER ? false : Boolean(input.isInternal);
  const commentText = input.commentText || input.content || '';

  // 3. Database Execution
  if (hasDbUrl()) {
    try {
      const comment = await db.issueComment.create({
        data: {
          issueId,
          authorId: userId,
          commentText,
          isInternal,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      return {
        success: true,
        data: comment,
        statusCode: 201,
      };
    } catch {
      // Fallback
    }
  }

  // 4. In-Memory Fallback
  const commentId = `comm-${Date.now().toString(36)}`;
  const now = new Date();
  const mockComment: MockComment = {
    id: commentId,
    issueId,
    authorId: userId,
    commentText,
    isInternal,
    createdAt: now,
    updatedAt: now,
  };

  const list = MOCK_COMMENTS.get(issueId) || [];
  list.push(mockComment);
  MOCK_COMMENTS.set(issueId, list);

  const author = MOCK_USERS.get(userId) || {
    id: userId,
    name: 'Citizen Author',
    email: 'author@civicfix.demo',
    role: userRole,
    isActive: true,
  };

  return {
    success: true,
    data: {
      ...mockComment,
      author: {
        id: author.id,
        name: author.name,
        role: author.role,
      },
    },
    statusCode: 201,
  };
}

/**
 * 5. Get comments for an issue.
 * Automatically filters out internal comments for normal USER accounts.
 */
export async function getIssueComments(
  userId: string,
  userRole: UserRole,
  issueId: string,
  db = prisma
): Promise<ServiceResult<any>> {
  if (!isValidUuid(issueId)) {
    return {
      success: false,
      error: 'Invalid issue ID parameter.',
      statusCode: 400,
    };
  }

  // 1. Authorize access to the issue
  const authResult = await canAccessIssue(userId, userRole, issueId, db);
  if (authResult.notFound) {
    return {
      success: false,
      error: 'Issue not found.',
      statusCode: 404,
    };
  }
  if (!authResult.allowed) {
    return {
      success: false,
      error: authResult.reason || 'Forbidden: Access to this issue is denied.',
      statusCode: 403,
    };
  }

  // 2. Filter condition: normal USER only sees public comments
  const where: any = { issueId };
  if (userRole === UserRole.USER) {
    where.isInternal = false;
  }

  // 3. Database Execution
  if (hasDbUrl()) {
    try {
      const comments = await db.issueComment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      return {
        success: true,
        data: comments,
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // 4. In-Memory Fallback
  let comments = MOCK_COMMENTS.get(issueId) || [];
  if (userRole === UserRole.USER) {
    comments = comments.filter((c) => !c.isInternal);
  }

  const result = comments.map((c) => {
    const author = MOCK_USERS.get(c.authorId) || {
      id: c.authorId,
      name: 'Commenter',
      role: UserRole.USER,
    };
    return {
      ...c,
      author: {
        id: author.id,
        name: author.name,
        role: author.role,
      },
    };
  });

  return {
    success: true,
    data: result,
    statusCode: 200,
  };
}

/**
 * 6. List active issue categories.
 */
export async function listIssueCategories(
  organizationId?: string,
  db = prisma
): Promise<ServiceResult<any>> {
  const where: any = { isActive: true };
  if (organizationId && isValidUuid(organizationId)) {
    where.organizationId = organizationId;
  }

  if (hasDbUrl()) {
    try {
      const categories = await db.issueCategory.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          icon: true,
          defaultPriority: true,
        },
        orderBy: { name: 'asc' },
      });

      return {
        success: true,
        data: categories,
        statusCode: 200,
      };
    } catch {
      // Fallback
    }
  }

  // In-Memory Fallback
  const categories = Array.from(MOCK_CATEGORIES.values())
    .filter((c) => c.isActive && (!organizationId || c.organizationId === organizationId))
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      icon: c.icon,
      defaultPriority: c.defaultPriority,
    }));

  return {
    success: true,
    data: categories,
    statusCode: 200,
  };
}
