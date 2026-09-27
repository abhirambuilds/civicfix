// ==============================================================================
// CivicFix - Database Seed Script
// Safe, idempotent development and demo environment seeder.
// Never stores plaintext passwords. Uses bcryptjs with environment variables.
// ==============================================================================

import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

// Load .env from backend or workspace root before initializing Prisma
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import {
  PrismaClient,
  UserRole,
  OrganizationType,
  OrgMemberRole,
  IssueStatus,
  IssuePriority,
  BoundaryType,
} from '@prisma/client';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

// Deterministic UUIDs matching supabase/schema.sql
const IDS = {
  org: 'a0000000-0000-0000-0000-000000000001',
  departments: {
    civil: 'b0000000-0000-0000-0000-000000000001',
    electrical: 'b0000000-0000-0000-0000-000000000002',
    sanitation: 'b0000000-0000-0000-0000-000000000003',
    water: 'b0000000-0000-0000-0000-000000000004',
    maintenance: 'b0000000-0000-0000-0000-000000000005',
  },
  categories: {
    pothole: 'c0000000-0000-0000-0000-000000000001',
    streetlight: 'c0000000-0000-0000-0000-000000000002',
    waste: 'c0000000-0000-0000-0000-000000000003',
    water: 'c0000000-0000-0000-0000-000000000004',
    electrical: 'c0000000-0000-0000-0000-000000000005',
    infrastructure: 'c0000000-0000-0000-0000-000000000006',
    other: 'c0000000-0000-0000-0000-000000000007',
  },
  serviceArea: 'd0000000-0000-0000-0000-000000000001',
  routingRules: {
    pothole: 'e0000000-0000-0000-0000-000000000001',
    streetlight: 'e0000000-0000-0000-0000-000000000002',
    waste: 'e0000000-0000-0000-0000-000000000003',
    water: 'e0000000-0000-0000-0000-000000000004',
    electrical: 'e0000000-0000-0000-0000-000000000005',
    infrastructure: 'e0000000-0000-0000-0000-000000000006',
    other: 'e0000000-0000-0000-0000-000000000007',
  },
  users: {
    platformAdmin: 'f0000000-0000-0000-0000-000000000001',
    orgOwner: 'f0000000-0000-0000-0000-000000000002',
    orgAdmin: 'f0000000-0000-0000-0000-000000000003',
    manager: 'f0000000-0000-0000-0000-000000000004',
    staff: 'f0000000-0000-0000-0000-000000000005',
    student: 'f0000000-0000-0000-0000-000000000006',
  },
  issues: {
    streetlight: 'a1000000-0000-0000-0000-000000000001',
    pothole: 'a1000000-0000-0000-0000-000000000002',
    waterLeak: 'a1000000-0000-0000-0000-000000000003',
  },
};

export async function runSeed(): Promise<void> {
  console.log('================================================================');
  console.log(' CivicFix - Database Seed Script');
  console.log('================================================================');

  // 1. Verify Database URL
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    throw new Error(
      'DATABASE_URL is not defined in environment or .env file. Populate DATABASE_URL before seeding.'
    );
  }

  // 2. Validate Password Environment Variables
  const passwordVars = [
    { key: 'SEED_PLATFORM_ADMIN_PASSWORD', label: 'Platform Admin' },
    { key: 'SEED_ORG_OWNER_PASSWORD', label: 'SRM Org Owner' },
    { key: 'SEED_ORG_ADMIN_PASSWORD', label: 'SRM Org Admin' },
    { key: 'SEED_MANAGER_PASSWORD', label: 'Department Manager' },
    { key: 'SEED_STAFF_PASSWORD', label: 'Staff Technician' },
    { key: 'SEED_USER_PASSWORD', label: 'Student / User' },
  ];

  const missingPasswords = passwordVars.filter(
    (p) => !process.env[p.key] || process.env[p.key]?.trim() === ''
  );

  if (missingPasswords.length > 0) {
    console.error('\n[CivicFix Seed] ERROR: Missing required seed password environment variables!');
    console.error('[CivicFix Seed] The following variables must be defined before seeding demo users:');
    missingPasswords.forEach((p) => console.error(`  - ${p.key} (${p.label})`));
    console.error('\nSet these values in your backend/.env file or export them in your shell.\n');
    throw new Error('Seed password environment variables missing.');
  }

  console.log('[1/7] Seeding Demo Organization...');
  const organization = await prisma.organization.upsert({
    where: { id: IDS.org },
    update: {
      name: 'SRM Campus Administration',
      slug: 'srm-campus-admin',
      description:
        'Administrative and facilities maintenance authority for SRM Institute of Science and Technology, Kattankulathur Campus.',
      orgType: OrganizationType.UNIVERSITY,
      isActive: true,
    },
    create: {
      id: IDS.org,
      name: 'SRM Campus Administration',
      slug: 'srm-campus-admin',
      description:
        'Administrative and facilities maintenance authority for SRM Institute of Science and Technology, Kattankulathur Campus.',
      orgType: OrganizationType.UNIVERSITY,
      isActive: true,
    },
  });
  console.log(`      ✓ Organization: ${organization.name} (${organization.slug})`);

  console.log('[2/7] Seeding Departments...');
  const departmentsData = [
    {
      id: IDS.departments.civil,
      name: 'Civil / Infrastructure',
      code: 'CIVIL',
      description:
        'Responsible for roads, pavements, structural repairs, campus buildings, and civil infrastructure.',
    },
    {
      id: IDS.departments.electrical,
      name: 'Electrical',
      code: 'ELECTRICAL',
      description:
        'Manages streetlights, outdoor illumination, wiring, transformers, and electrical fixtures.',
    },
    {
      id: IDS.departments.sanitation,
      name: 'Sanitation & Waste',
      code: 'SANITATION',
      description:
        'Oversees garbage collection, litter management, campus cleanliness, and waste disposal bins.',
    },
    {
      id: IDS.departments.water,
      name: 'Water & Drainage',
      code: 'WATER',
      description:
        'Handles water pipeline leaks, drinking water stations, storm drains, and sewage infrastructure.',
    },
    {
      id: IDS.departments.maintenance,
      name: 'General Maintenance',
      code: 'MAINTENANCE',
      description:
        'General campus upkeep, miscellaneous physical requests, and uncategorized issue resolution.',
    },
  ];

  for (const dept of departmentsData) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: {
        organizationId: organization.id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        isActive: true,
      },
      create: {
        id: dept.id,
        organizationId: organization.id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        isActive: true,
      },
    });
  }
  console.log(`      ✓ Seeded ${departmentsData.length} departments.`);

  console.log('[3/7] Seeding Issue Categories...');
  const categoriesData = [
    {
      id: IDS.categories.pothole,
      name: 'Pothole / Road',
      slug: 'pothole-road',
      description:
        'Damaged roads, potholes, broken sidewalks, speed bump issues, or dangerous walkway surfaces.',
      icon: 'road',
      defaultPriority: IssuePriority.HIGH,
    },
    {
      id: IDS.categories.streetlight,
      name: 'Streetlight',
      slug: 'streetlight',
      description:
        'Non-functional streetlights, flickering outdoor lights, dark pathways, or damaged lampposts.',
      icon: 'lightbulb',
      defaultPriority: IssuePriority.MEDIUM,
    },
    {
      id: IDS.categories.waste,
      name: 'Waste',
      slug: 'waste',
      description:
        'Overflowing garbage bins, scattered trash, uncollected debris, or biohazard disposal concerns.',
      icon: 'trash',
      defaultPriority: IssuePriority.MEDIUM,
    },
    {
      id: IDS.categories.water,
      name: 'Water Leakage',
      slug: 'water-leakage',
      description:
        'Burst water pipes, dripping taps, water logging, leaking outdoor pipes, or flooded walkways.',
      icon: 'droplet',
      defaultPriority: IssuePriority.HIGH,
    },
    {
      id: IDS.categories.electrical,
      name: 'Electrical',
      slug: 'electrical',
      description:
        'Exposed electrical cables, spark hazards, broken switchboards, or power distribution boxes.',
      icon: 'zap',
      defaultPriority: IssuePriority.CRITICAL,
    },
    {
      id: IDS.categories.infrastructure,
      name: 'Infrastructure',
      slug: 'infrastructure',
      description:
        'Damaged railings, broken benches, signposts, building cracks, gates, or general physical fixtures.',
      icon: 'building',
      defaultPriority: IssuePriority.MEDIUM,
    },
    {
      id: IDS.categories.other,
      name: 'Other',
      slug: 'other',
      description: 'General issues that do not fall under conventional categories.',
      icon: 'help-circle',
      defaultPriority: IssuePriority.LOW,
    },
  ];

  for (const cat of categoriesData) {
    await prisma.issueCategory.upsert({
      where: { id: cat.id },
      update: {
        organizationId: organization.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        defaultPriority: cat.defaultPriority,
        isActive: true,
      },
      create: {
        id: cat.id,
        organizationId: organization.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        defaultPriority: cat.defaultPriority,
        isActive: true,
      },
    });
  }
  console.log(`      ✓ Seeded ${categoriesData.length} issue categories.`);

  console.log('[4/7] Seeding Demo Service Area & Routing Rules...');
  // SRM Kattankulathur Campus Demo Service Area
  await prisma.organizationServiceArea.upsert({
    where: { id: IDS.serviceArea },
    update: {
      organizationId: organization.id,
      name: 'SRM Kattankulathur Campus Perimeter (DEMO SERVICE AREA)',
      boundaryType: BoundaryType.POLYGON,
      minLatitude: 12.815,
      maxLatitude: 12.835,
      minLongitude: 80.035,
      maxLongitude: 80.055,
      centerLatitude: 12.823,
      centerLongitude: 80.0444,
      radiusKm: 2.5,
      boundaryGeojson: {
        type: 'Polygon',
        coordinates: [
          [
            [80.035, 12.815],
            [80.055, 12.815],
            [80.055, 12.835],
            [80.035, 12.835],
            [80.035, 12.815],
          ],
        ],
      },
      isActive: true,
    },
    create: {
      id: IDS.serviceArea,
      organizationId: organization.id,
      name: 'SRM Kattankulathur Campus Perimeter (DEMO SERVICE AREA)',
      boundaryType: BoundaryType.POLYGON,
      minLatitude: 12.815,
      maxLatitude: 12.835,
      minLongitude: 80.035,
      maxLongitude: 80.055,
      centerLatitude: 12.823,
      centerLongitude: 80.0444,
      radiusKm: 2.5,
      boundaryGeojson: {
        type: 'Polygon',
        coordinates: [
          [
            [80.035, 12.815],
            [80.055, 12.815],
            [80.055, 12.835],
            [80.035, 12.835],
            [80.035, 12.815],
          ],
        ],
      },
      isActive: true,
    },
  });
  console.log('      ✓ Seeded SRM Demo Service Area.');

  // Routing Rules (Categories -> Departments)
  const routingRulesData = [
    {
      id: IDS.routingRules.pothole,
      categoryId: IDS.categories.pothole,
      departmentId: IDS.departments.civil,
      priority: IssuePriority.HIGH,
      keywords: ['pothole', 'road', 'asphalt', 'sidewalk', 'pavement', 'tar'],
      order: 10,
    },
    {
      id: IDS.routingRules.streetlight,
      categoryId: IDS.categories.streetlight,
      departmentId: IDS.departments.electrical,
      priority: IssuePriority.MEDIUM,
      keywords: ['streetlight', 'lamp', 'dark', 'bulb', 'lighting', 'pole'],
      order: 20,
    },
    {
      id: IDS.routingRules.waste,
      categoryId: IDS.categories.waste,
      departmentId: IDS.departments.sanitation,
      priority: IssuePriority.MEDIUM,
      keywords: ['garbage', 'waste', 'trash', 'dustbin', 'litter', 'overflow'],
      order: 30,
    },
    {
      id: IDS.routingRules.water,
      categoryId: IDS.categories.water,
      departmentId: IDS.departments.water,
      priority: IssuePriority.HIGH,
      keywords: ['leak', 'pipe', 'water', 'flood', 'drain', 'burst'],
      order: 40,
    },
    {
      id: IDS.routingRules.electrical,
      categoryId: IDS.categories.electrical,
      departmentId: IDS.departments.electrical,
      priority: IssuePriority.CRITICAL,
      keywords: ['spark', 'wire', 'shock', 'electric', 'short circuit', 'panel'],
      order: 50,
    },
    {
      id: IDS.routingRules.infrastructure,
      categoryId: IDS.categories.infrastructure,
      departmentId: IDS.departments.civil,
      priority: IssuePriority.MEDIUM,
      keywords: ['bench', 'wall', 'crack', 'building', 'gate', 'railing', 'structure'],
      order: 60,
    },
    {
      id: IDS.routingRules.other,
      categoryId: IDS.categories.other,
      departmentId: IDS.departments.maintenance,
      priority: IssuePriority.LOW,
      keywords: ['other', 'general', 'misc', 'maintenance'],
      order: 100,
    },
  ];

  for (const rule of routingRulesData) {
    await prisma.routingRule.upsert({
      where: { id: rule.id },
      update: {
        organizationId: organization.id,
        categoryId: rule.categoryId,
        departmentId: rule.departmentId,
        overridePriority: rule.priority,
        keywords: rule.keywords,
        ruleOrder: rule.order,
        isActive: true,
      },
      create: {
        id: rule.id,
        organizationId: organization.id,
        categoryId: rule.categoryId,
        departmentId: rule.departmentId,
        overridePriority: rule.priority,
        keywords: rule.keywords,
        ruleOrder: rule.order,
        isActive: true,
      },
    });
  }
  console.log(`      ✓ Seeded ${routingRulesData.length} deterministic routing rules.`);

  console.log('[5/7] Seeding Demo Users (Bcrypt Hashed)...');
  const usersData = [
    {
      id: IDS.users.platformAdmin,
      name: 'Platform Superadmin',
      email: 'platform.admin@civicfix.demo',
      role: UserRole.PLATFORM_ADMIN,
      passwordEnv: 'SEED_PLATFORM_ADMIN_PASSWORD',
    },
    {
      id: IDS.users.orgOwner,
      name: 'SRM Administration Owner',
      email: 'srm.owner@civicfix.demo',
      role: UserRole.ORG_OWNER,
      passwordEnv: 'SEED_ORG_OWNER_PASSWORD',
    },
    {
      id: IDS.users.orgAdmin,
      name: 'SRM Operations Admin',
      email: 'srm.admin@civicfix.demo',
      role: UserRole.ORG_ADMIN,
      passwordEnv: 'SEED_ORG_ADMIN_PASSWORD',
    },
    {
      id: IDS.users.manager,
      name: 'Civil Infrastructure Manager',
      email: 'manager@civicfix.demo',
      role: UserRole.MANAGER,
      passwordEnv: 'SEED_MANAGER_PASSWORD',
    },
    {
      id: IDS.users.staff,
      name: 'Electrical Field Technician',
      email: 'staff@civicfix.demo',
      role: UserRole.STAFF,
      passwordEnv: 'SEED_STAFF_PASSWORD',
    },
    {
      id: IDS.users.student,
      name: 'SRM Campus Student',
      email: 'student@civicfix.demo',
      role: UserRole.USER,
      passwordEnv: 'SEED_USER_PASSWORD',
    },
  ];

  for (const u of usersData) {
    const rawPassword = process.env[u.passwordEnv] as string;
    const passwordHash = await bcrypt.hash(rawPassword, BCRYPT_ROUNDS);

    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash,
        role: u.role,
        isActive: true,
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        isActive: true,
      },
    });
  }
  console.log(`      ✓ Seeded ${usersData.length} demo users with bcrypt password hashes.`);

  console.log('[6/7] Seeding Memberships (Org & Department)...');
  // Organization Memberships
  const orgMembers = [
    { userId: IDS.users.orgOwner, role: OrgMemberRole.OWNER },
    { userId: IDS.users.orgAdmin, role: OrgMemberRole.ADMIN },
    { userId: IDS.users.manager, role: OrgMemberRole.MANAGER },
    { userId: IDS.users.staff, role: OrgMemberRole.STAFF },
  ];

  for (const m of orgMembers) {
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: m.userId,
        },
      },
      update: {
        orgRole: m.role,
        isActive: true,
      },
      create: {
        organizationId: organization.id,
        userId: m.userId,
        orgRole: m.role,
        isActive: true,
      },
    });
  }
  console.log(`      ✓ Seeded ${orgMembers.length} organization memberships.`);

  // Department Memberships
  // Manager -> Civil / Infrastructure
  await prisma.departmentMember.upsert({
    where: {
      departmentId_userId: {
        departmentId: IDS.departments.civil,
        userId: IDS.users.manager,
      },
    },
    update: {
      roleInDepartment: 'DEPARTMENT_HEAD',
      isActive: true,
    },
    create: {
      departmentId: IDS.departments.civil,
      userId: IDS.users.manager,
      roleInDepartment: 'DEPARTMENT_HEAD',
      isActive: true,
    },
  });

  // Staff -> Electrical
  await prisma.departmentMember.upsert({
    where: {
      departmentId_userId: {
        departmentId: IDS.departments.electrical,
        userId: IDS.users.staff,
      },
    },
    update: {
      roleInDepartment: 'FIELD_TECHNICIAN',
      isActive: true,
    },
    create: {
      departmentId: IDS.departments.electrical,
      userId: IDS.users.staff,
      roleInDepartment: 'FIELD_TECHNICIAN',
      isActive: true,
    },
  });
  console.log('      ✓ Seeded department memberships (Manager -> Civil, Staff -> Electrical).');

  console.log('[7/7] Seeding Sample Demo Issues...');
  // Issue 1: Streetlight issue (IN_PROGRESS)
  const issue1 = await prisma.issue.upsert({
    where: { issueNumber: 'CF-SRM-2026-0001' },
    update: {
      title: 'Streetlight flickering near Hostel 3 walkway',
      description:
        'Outdoor streetlight lamp post #14 flickers intermittently and shuts off completely after 9 PM, causing poor visibility on the pedestrian path.',
      status: IssueStatus.IN_PROGRESS,
      priority: IssuePriority.MEDIUM,
      categoryId: IDS.categories.streetlight,
      organizationId: organization.id,
      reporterId: IDS.users.student,
    },
    create: {
      id: IDS.issues.streetlight,
      issueNumber: 'CF-SRM-2026-0001',
      title: 'Streetlight flickering near Hostel 3 walkway',
      description:
        'Outdoor streetlight lamp post #14 flickers intermittently and shuts off completely after 9 PM, causing poor visibility on the pedestrian path.',
      status: IssueStatus.IN_PROGRESS,
      priority: IssuePriority.MEDIUM,
      categoryId: IDS.categories.streetlight,
      organizationId: organization.id,
      reporterId: IDS.users.student,
      location: {
        create: {
          latitude: 12.8242,
          longitude: 80.0435,
          address: 'Pedestrian Path near Hostel Block 3, SRM KTR Campus',
          landmark: 'Hostel 3 Gate',
        },
      },
      assignments: {
        create: {
          departmentId: IDS.departments.electrical,
          assignedUserId: IDS.users.staff,
          assignedById: IDS.users.orgAdmin,
          notes: 'Assigned to Electrical maintenance team for fixture/driver replacement.',
          isActive: true,
        },
      },
      comments: {
        create: {
          authorId: IDS.users.orgAdmin,
          commentText: 'Electrical team dispatched to inspect lamp post wiring and replace LED driver.',
          isInternal: false,
        },
      },
      statusHistory: {
        createMany: {
          data: [
            {
              previousStatus: null,
              newStatus: IssueStatus.REPORTED,
              changedById: IDS.users.student,
              remark: 'Issue reported by student.',
            },
            {
              previousStatus: IssueStatus.REPORTED,
              newStatus: IssueStatus.IN_PROGRESS,
              changedById: IDS.users.orgAdmin,
              remark: 'Triage complete. Dispatched to electrical team.',
            },
          ],
        },
      },
    },
  });

  // Issue 2: Pothole issue (REPORTED)
  const issue2 = await prisma.issue.upsert({
    where: { issueNumber: 'CF-SRM-2026-0002' },
    update: {
      title: 'Pothole on Main Campus Avenue near Tech Park',
      description:
        'Deep pothole formed on the right lane near the Tech Park roundabout. Poses a safety hazard for two-wheelers and campus shuttles.',
      status: IssueStatus.REPORTED,
      priority: IssuePriority.HIGH,
      categoryId: IDS.categories.pothole,
      organizationId: organization.id,
      reporterId: IDS.users.student,
    },
    create: {
      id: IDS.issues.pothole,
      issueNumber: 'CF-SRM-2026-0002',
      title: 'Pothole on Main Campus Avenue near Tech Park',
      description:
        'Deep pothole formed on the right lane near the Tech Park roundabout. Poses a safety hazard for two-wheelers and campus shuttles.',
      status: IssueStatus.REPORTED,
      priority: IssuePriority.HIGH,
      categoryId: IDS.categories.pothole,
      organizationId: organization.id,
      reporterId: IDS.users.student,
      location: {
        create: {
          latitude: 12.8228,
          longitude: 80.045,
          address: 'Tech Park Avenue, Opp. Central Library, SRM KTR Campus',
          landmark: 'Opposite Central Library',
        },
      },
      statusHistory: {
        create: {
          previousStatus: null,
          newStatus: IssueStatus.REPORTED,
          changedById: IDS.users.student,
          remark: 'Issue reported by student via mobile submission.',
        },
      },
    },
  });

  // Issue 3: Water Leakage issue (RESOLVED)
  const issue3 = await prisma.issue.upsert({
    where: { issueNumber: 'CF-SRM-2026-0003' },
    update: {
      title: 'Water pipe leakage near Bio-Engineering block',
      description:
        'Clean water pipe joint leaking continuously at ground level, creating localized water logging.',
      status: IssueStatus.RESOLVED,
      priority: IssuePriority.HIGH,
      categoryId: IDS.categories.water,
      organizationId: organization.id,
      reporterId: IDS.users.student,
      resolvedAt: new Date(),
    },
    create: {
      id: IDS.issues.waterLeak,
      issueNumber: 'CF-SRM-2026-0003',
      title: 'Water pipe leakage near Bio-Engineering block',
      description:
        'Clean water pipe joint leaking continuously at ground level, creating localized water logging.',
      status: IssueStatus.RESOLVED,
      priority: IssuePriority.HIGH,
      categoryId: IDS.categories.water,
      organizationId: organization.id,
      reporterId: IDS.users.student,
      resolvedAt: new Date(),
      location: {
        create: {
          latitude: 12.8215,
          longitude: 80.0428,
          address: 'Ground floor lawn, Bio-Engineering Block, SRM KTR Campus',
          landmark: 'Bio-Eng Lawn',
        },
      },
      assignments: {
        create: {
          departmentId: IDS.departments.water,
          assignedUserId: IDS.users.manager,
          assignedById: IDS.users.orgAdmin,
          notes: 'Assigned to Water & Drainage team.',
          isActive: false,
        },
      },
      comments: {
        create: {
          authorId: IDS.users.manager,
          commentText: 'Joint gasket replaced and pressure tested. Water flow restored with zero leakage.',
          isInternal: false,
        },
      },
      statusHistory: {
        createMany: {
          data: [
            {
              previousStatus: null,
              newStatus: IssueStatus.REPORTED,
              changedById: IDS.users.student,
              remark: 'Issue reported by student.',
            },
            {
              previousStatus: IssueStatus.REPORTED,
              newStatus: IssueStatus.IN_PROGRESS,
              changedById: IDS.users.orgAdmin,
              remark: 'Plumbing team dispatched.',
            },
            {
              previousStatus: IssueStatus.IN_PROGRESS,
              newStatus: IssueStatus.RESOLVED,
              changedById: IDS.users.manager,
              remark: 'Pipe joint repaired successfully.',
            },
          ],
        },
      },
    },
  });
  console.log(
    `      ✓ Seeded 3 demo issues: ${issue1.issueNumber} (IN_PROGRESS), ${issue2.issueNumber} (REPORTED), ${issue3.issueNumber} (RESOLVED).`
  );

  console.log('\n================================================================');
  console.log(' Seed Completed Successfully (100% Idempotent)');
  console.log('================================================================\n');
}

// Execute standalone when invoked directly
if (process.argv[1]?.includes('seed')) {
  runSeed()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('[CivicFix Seed] Error during seed execution:', e.message);
      await prisma.$disconnect();
      process.exit(1);
    });
}
