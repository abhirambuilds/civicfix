import http from 'http';
import { UserRole, OrgMemberRole, OrganizationType } from '@prisma/client';
import { app } from '../index.js';
import { generateToken } from '../services/auth.service.js';

interface TestSummary {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestSummary[] = [];

function assert(condition: boolean, testName: string, errorDetail?: string) {
  if (condition) {
    results.push({ name: testName, passed: true });
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    results.push({ name: testName, passed: false, error: errorDetail });
    console.error(`  ✗ [FAIL] ${testName} - ${errorDetail || 'Assertion failed'}`);
  }
}

async function runOrgTests() {
  console.log('\n================================================================');
  console.log(' CivicFix - Organization Management & Platform Admin API Test Suite');
  console.log('================================================================\n');

  // Seeded User IDs (from backend/prisma/seed.ts)
  const PLATFORM_ADMIN_ID = 'f0000000-0000-0000-0000-000000000001';
  const ORG_OWNER_ID = 'f0000000-0000-0000-0000-000000000002';
  const ORG_ADMIN_ID = 'f0000000-0000-0000-0000-000000000003';
  const MANAGER_ID = 'f0000000-0000-0000-0000-000000000004';
  const STAFF_ID = 'f0000000-0000-0000-0000-000000000005';
  const USER_1_ID = 'f0000000-0000-0000-0000-000000000006';
  const USER_2_ID = 'f0000000-0000-0000-0000-000000000007';

  // Seeded Organization IDs
  const SRM_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
  const UNRELATED_ORG_ID = 'a0000000-0000-0000-0000-000000000099';

  // Tokens
  const platformAdminToken = generateToken({ id: PLATFORM_ADMIN_ID, role: UserRole.PLATFORM_ADMIN });
  const orgOwnerToken = generateToken({ id: ORG_OWNER_ID, role: UserRole.ORG_OWNER });
  const orgAdminToken = generateToken({ id: ORG_ADMIN_ID, role: UserRole.ORG_ADMIN });
  const managerToken = generateToken({ id: MANAGER_ID, role: UserRole.MANAGER });
  const staffToken = generateToken({ id: STAFF_ID, role: UserRole.STAFF });
  const user1Token = generateToken({ id: USER_1_ID, role: UserRole.USER });

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  let createdOrgId = '';

  try {
    // ============================================================================
    // SUITE 1: ORGANIZATION CREATION (PLATFORM_ADMIN ONLY)
    // ============================================================================
    console.log('[Suite 1] Organization Creation & Validation');

    // 1.1 USER cannot create organization -> 403
    const userCreateRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        name: 'Illegal Org',
        description: 'Should fail',
        orgType: OrganizationType.MUNICIPALITY,
      }),
    });
    assert(userCreateRes.status === 403, 'USER denied from creating organizations (403 Forbidden)');

    // 1.2 ORG_ADMIN cannot create organization -> 403
    const adminCreateRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        name: 'Another Illegal Org',
        description: 'Should fail',
      }),
    });
    assert(adminCreateRes.status === 403, 'ORG_ADMIN denied from creating organizations (403 Forbidden)');

    // 1.3 Validation error: Name too short (< 2 chars) -> 400
    const shortNameRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({ name: 'A' }),
    });
    assert(shortNameRes.status === 400, 'Validation: Organization name < 2 chars rejected (400 Bad Request)');

    // 1.4 Attempt to inject privileged properties (id, slug, isActive) -> 400
    const injectionRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({
        name: 'Valid Name Test',
        id: '00000000-0000-0000-0000-000000000000',
        slug: 'hacked-slug',
      }),
    });
    assert(injectionRes.status === 400, 'Security: Injection of server-generated fields rejected (400 Bad Request)');

    // 1.5 PLATFORM_ADMIN creates valid organization -> 201 Created
    const createRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({
        name: 'Chennai Metropolitan Municipality',
        description: 'Municipal governing body for Chennai urban region',
        orgType: OrganizationType.MUNICIPALITY,
      }),
    });
    const createJson = (await createRes.json()) as any;
    assert(createRes.status === 201, 'PLATFORM_ADMIN creates organization successfully (201 Created)');
    assert(createJson.data?.slug === 'chennai-metropolitan-municipality', 'Slug generated automatically from name');
    createdOrgId = createJson.data?.id;

    // 1.6 Duplicate organization name rejected -> 409 Conflict
    const dupRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({
        name: 'Chennai Metropolitan Municipality',
        description: 'Duplicate attempt',
      }),
    });
    assert(dupRes.status === 409, 'Duplicate organization name rejected with 409 Conflict');

    // ============================================================================
    // SUITE 2: LIST ORGANIZATIONS
    // ============================================================================
    console.log('\n[Suite 2] List Organizations Scoped by Role');

    // 2.1 USER cannot list organizations -> 403 Forbidden
    const userListRes = await fetch(`${baseUrl}/api/organizations`, {
      headers: authHeader(user1Token),
    });
    assert(userListRes.status === 403, 'USER denied from listing organizations (403 Forbidden)');

    // 2.2 PLATFORM_ADMIN lists all organizations -> 200 OK
    const platListRes = await fetch(`${baseUrl}/api/organizations`, {
      headers: authHeader(platformAdminToken),
    });
    const platListJson = (await platListRes.json()) as any;
    assert(platListRes.status === 200, 'PLATFORM_ADMIN lists all organizations (200 OK)');
    assert(Array.isArray(platListJson.data?.organizations), 'Organizations returned as array');
    assert(platListJson.data?.organizations?.length >= 2, 'List includes SRM and newly created organization');

    // 2.3 ORG_ADMIN lists only own organization memberships -> 200 OK
    const adminListRes = await fetch(`${baseUrl}/api/organizations`, {
      headers: authHeader(orgAdminToken),
    });
    const adminListJson = (await adminListRes.json()) as any;
    assert(adminListRes.status === 200, 'ORG_ADMIN lists associated organizations (200 OK)');
    const adminOrgIds = adminListJson.data?.organizations?.map((o: any) => o.id);
    assert(adminOrgIds.includes(SRM_ORG_ID), 'ORG_ADMIN list includes SRM Campus Admin');
    assert(!adminOrgIds.includes(createdOrgId), 'Org Isolation: Unrelated org excluded from ORG_ADMIN list');

    // ============================================================================
    // SUITE 3: GET ORGANIZATION DETAILS & MULTI-TENANT ISOLATION
    // ============================================================================
    console.log('\n[Suite 3] Organization Retrieval & Isolation');

    // 3.1 Malformed organizationId -> 400
    const malformedGet = await fetch(`${baseUrl}/api/organizations/not-a-uuid`, {
      headers: authHeader(platformAdminToken),
    });
    assert(malformedGet.status === 400, 'Malformed organizationId rejected with 400');

    // 3.2 Non-existent organizationId -> 404
    const notFoundGet = await fetch(`${baseUrl}/api/organizations/${UNRELATED_ORG_ID}`, {
      headers: authHeader(platformAdminToken),
    });
    assert(notFoundGet.status === 404, 'Non-existent organizationId returns 404 Not Found');

    // 3.3 USER denied from getting organization -> 403
    const userGetRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}`, {
      headers: authHeader(user1Token),
    });
    assert(userGetRes.status === 403, 'USER denied from getting organization details (403 Forbidden)');

    // 3.4 ORG_ADMIN gets own organization -> 200 OK
    const adminGetOwn = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}`, {
      headers: authHeader(orgAdminToken),
    });
    assert(adminGetOwn.status === 200, 'ORG_ADMIN permitted on own organization (200 OK)');

    // 3.5 ORG_ADMIN gets unrelated organization -> 403 Forbidden
    const adminGetOther = await fetch(`${baseUrl}/api/organizations/${createdOrgId}`, {
      headers: authHeader(orgAdminToken),
    });
    assert(adminGetOther.status === 403, 'Org Isolation: ORG_ADMIN denied on unrelated organization (403 Forbidden)');

    // 3.6 PLATFORM_ADMIN gets any organization -> 200 OK
    const platGetRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}`, {
      headers: authHeader(platformAdminToken),
    });
    assert(platGetRes.status === 200, 'PLATFORM_ADMIN permitted on any organization (200 OK)');

    // ============================================================================
    // SUITE 4: UPDATE ORGANIZATION METADATA
    // ============================================================================
    console.log('\n[Suite 4] Organization Updates');

    // 4.1 STAFF cannot update organization -> 403
    const staffUpdateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}`, {
      method: 'PATCH',
      headers: authHeader(staffToken),
      body: JSON.stringify({ description: 'Hacked description' }),
    });
    assert(staffUpdateRes.status === 403, 'STAFF denied from updating organization (403 Forbidden)');

    // 4.2 MANAGER cannot update organization -> 403
    const managerUpdateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}`, {
      method: 'PATCH',
      headers: authHeader(managerToken),
      body: JSON.stringify({ description: 'Hacked description' }),
    });
    assert(managerUpdateRes.status === 403, 'MANAGER denied from updating organization (403 Forbidden)');

    // 4.3 ORG_ADMIN updates own organization description -> 200 OK
    const adminUpdateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}`, {
      method: 'PATCH',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ description: 'Updated SRM campus administration description' }),
    });
    assert(adminUpdateRes.status === 200, 'ORG_ADMIN updates own organization successfully (200 OK)');

    // 4.4 ORG_ADMIN cannot update another organization -> 403
    const adminUpdateOtherRes = await fetch(`${baseUrl}/api/organizations/${createdOrgId}`, {
      method: 'PATCH',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ description: 'Hacked description' }),
    });
    assert(adminUpdateOtherRes.status === 403, 'Org Isolation: ORG_ADMIN cannot update another organization (403)');

    // 4.5 PLATFORM_ADMIN updates organization -> 200 OK
    const platformUpdateRes = await fetch(`${baseUrl}/api/organizations/${createdOrgId}`, {
      method: 'PATCH',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({ description: 'Updated platform description by superadmin' }),
    });
    assert(platformUpdateRes.status === 200, 'PLATFORM_ADMIN updates organization successfully (200 OK)');

    // 4.6 Injection of server-generated fields rejected -> 400 Bad Request
    const injectUpdateRes = await fetch(`${baseUrl}/api/organizations/${createdOrgId}`, {
      method: 'PATCH',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({ id: 'f0000000-0000-0000-0000-000000000099', createdAt: new Date() }),
    });
    assert(injectUpdateRes.status === 400, 'Security: Injection of server-generated fields on update rejected (400)');

    // ============================================================================
    // SUITE 5: ACTIVATE / DEACTIVATE ORGANIZATION (PLATFORM_ADMIN ONLY)
    // ============================================================================
    console.log('\n[Suite 5] Organization Activation & Deactivation');

    // 5.1 ORG_OWNER cannot change organization status -> 403
    const ownerStatusRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/status`, {
      method: 'PATCH',
      headers: authHeader(orgOwnerToken),
      body: JSON.stringify({ isActive: false }),
    });
    assert(ownerStatusRes.status === 403, 'ORG_OWNER denied from toggling org status (403 Forbidden)');

    // 5.2 PLATFORM_ADMIN deactivates created organization -> 200 OK
    const deactRes = await fetch(`${baseUrl}/api/organizations/${createdOrgId}/status`, {
      method: 'PATCH',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({ isActive: false }),
    });
    const deactJson = (await deactRes.json()) as any;
    assert(deactRes.status === 200, 'PLATFORM_ADMIN deactivates organization (200 OK)');
    assert(deactJson.data?.organization?.isActive === false, 'Organization isActive flag set to false');

    // 5.3 Inactive organization behavior: operational update by ORG_ADMIN rejected -> 403
    const inactiveUpdateRes = await fetch(`${baseUrl}/api/organizations/${createdOrgId}`, {
      method: 'PATCH',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ description: 'Should fail on inactive org' }),
    });
    assert(inactiveUpdateRes.status === 403, 'Inactive Org: Operational update rejected (403 Forbidden)');

    // 5.4 Inactive organization behavior: member addition to inactive org rejected -> 403
    const inactiveAddMemberRes = await fetch(`${baseUrl}/api/organizations/${createdOrgId}/members`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ userId: USER_2_ID, role: OrgMemberRole.STAFF }),
    });
    assert(inactiveAddMemberRes.status === 403, 'Inactive Org: Member addition rejected (403 Forbidden)');

    // 5.5 Malformed organizationId parameter in status update rejected -> 400
    const malformedStatusRes = await fetch(`${baseUrl}/api/organizations/invalid-uuid/status`, {
      method: 'PATCH',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({ isActive: true }),
    });
    assert(malformedStatusRes.status === 400, 'Security: Malformed status organizationId parameter rejected (400)');

    // 5.6 PLATFORM_ADMIN reactivates organization -> 200 OK
    const reactRes = await fetch(`${baseUrl}/api/organizations/${createdOrgId}/status`, {
      method: 'PATCH',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({ isActive: true }),
    });
    assert(reactRes.status === 200, 'PLATFORM_ADMIN reactivates organization (200 OK)');

    // ============================================================================
    // SUITE 6: ORGANIZATION MEMBERS MANAGEMENT
    // ============================================================================
    console.log('\n[Suite 6] Organization Members & Privilege Escalation Guards');

    // 6.1 USER cannot view organization members -> 403
    const userViewMembers = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      headers: authHeader(user1Token),
    });
    assert(userViewMembers.status === 403, 'USER denied from viewing organization members (403 Forbidden)');

    // 6.2 MANAGER cannot view organization members -> 403
    const managerViewMembers = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      headers: authHeader(managerToken),
    });
    assert(managerViewMembers.status === 403, 'MANAGER denied from viewing organization members (403 Forbidden)');

    // 6.3 STAFF cannot view organization members -> 403
    const staffViewMembers = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      headers: authHeader(staffToken),
    });
    assert(staffViewMembers.status === 403, 'STAFF denied from viewing organization members (403 Forbidden)');

    // 6.4 ORG_ADMIN views own organization members -> 200 OK
    const adminViewMembers = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      headers: authHeader(orgAdminToken),
    });
    const adminViewJson = (await adminViewMembers.json()) as any;
    assert(adminViewMembers.status === 200, 'ORG_ADMIN views organization members (200 OK)');
    assert(Array.isArray(adminViewJson.data?.members), 'Members returned as array');

    // Verify passwords/hashes never exposed
    const firstMember = adminViewJson.data?.members?.[0];
    assert(firstMember?.user?.passwordHash === undefined, 'Security: Member list does not expose password hashes');
    assert(firstMember?.user?.password === undefined, 'Security: Member list does not expose plaintext passwords');

    // 6.5 ORG_ADMIN attempts to add member with role: OWNER -> 403 Forbidden
    const adminAddOwnerRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        userId: USER_2_ID,
        role: OrgMemberRole.OWNER,
      }),
    });
    assert(adminAddOwnerRes.status === 403, 'Privilege Escalation: ORG_ADMIN cannot assign OWNER role (403)');

    // 6.6 ORG_ADMIN attempts to add member with role: ADMIN -> 403 Forbidden
    const adminAddAdminRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        userId: USER_2_ID,
        role: OrgMemberRole.ADMIN,
      }),
    });
    assert(adminAddAdminRes.status === 403, 'Privilege Escalation: ORG_ADMIN cannot assign ADMIN role (403)');

    // 6.7 User attempts to add themselves to organization -> 403 Forbidden
    const selfAddRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        userId: ORG_ADMIN_ID,
        role: OrgMemberRole.STAFF,
      }),
    });
    assert(selfAddRes.status === 403, 'Privilege Guard: Actor cannot add themselves (403 Forbidden)');

    // 6.8 ORG_ADMIN adds USER_2 as STAFF member -> 201 Created
    const addStaffRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        userId: USER_2_ID,
        role: OrgMemberRole.STAFF,
      }),
    });
    assert(addStaffRes.status === 201, 'ORG_ADMIN adds operational STAFF member successfully (201 Created)');

    // 6.9 Duplicate member addition rejected -> 409 Conflict
    const dupMemberRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        userId: USER_2_ID,
        role: OrgMemberRole.STAFF,
      }),
    });
    assert(dupMemberRes.status === 409, 'Duplicate organization member rejected with 409 Conflict');

    // 6.10 Malformed userId parameter in member update route rejected -> 400 Bad Request
    const malformedUserPatchRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/members/invalid-uuid`,
      {
        method: 'PATCH',
        headers: authHeader(orgAdminToken),
        body: JSON.stringify({ role: OrgMemberRole.MANAGER }),
      }
    );
    assert(malformedUserPatchRes.status === 400, 'Security: Malformed userId parameter on update rejected (400)');

    // 6.11 Malformed role in member update payload rejected -> 400 Bad Request
    const malformedRolePatchRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/members/${USER_2_ID}`,
      {
        method: 'PATCH',
        headers: authHeader(orgAdminToken),
        body: JSON.stringify({ role: 'SUPER_HERO' }),
      }
    );
    assert(malformedRolePatchRes.status === 400, 'Security: Invalid role enum in payload rejected (400)');

    // 6.12 ORG_ADMIN updates USER_2 role to MANAGER -> 200 OK
    const updateMemberRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/members/${USER_2_ID}`,
      {
        method: 'PATCH',
        headers: authHeader(orgAdminToken),
        body: JSON.stringify({ role: OrgMemberRole.MANAGER }),
      }
    );
    assert(updateMemberRes.status === 200, 'ORG_ADMIN updates operational member to MANAGER (200 OK)');

    // 6.13 User cannot modify their own organization role -> 403 Forbidden
    const selfModifyRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/members/${ORG_ADMIN_ID}`,
      {
        method: 'PATCH',
        headers: authHeader(orgAdminToken),
        body: JSON.stringify({ role: OrgMemberRole.OWNER }),
      }
    );
    assert(selfModifyRes.status === 403, 'Privilege Guard: User cannot modify own role (403 Forbidden)');

    // 6.14 Malformed userId parameter in member removal route rejected -> 400 Bad Request
    const malformedUserDelRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/members/invalid-uuid`,
      {
        method: 'DELETE',
        headers: authHeader(orgAdminToken),
      }
    );
    assert(malformedUserDelRes.status === 400, 'Security: Malformed userId parameter on remove rejected (400)');

    // 6.15 ORG_ADMIN deactivates (removes) USER_2 from organization -> 200 OK
    const removeRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/members/${USER_2_ID}`,
      {
        method: 'DELETE',
        headers: authHeader(orgAdminToken),
      }
    );
    assert(removeRes.status === 200, 'ORG_ADMIN deactivates member from organization (200 OK)');

    // 6.16 ORG_ADMIN cannot remove ORG_OWNER -> 403 Forbidden
    const removeOwnerRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/members/${ORG_OWNER_ID}`,
      {
        method: 'DELETE',
        headers: authHeader(orgAdminToken),
      }
    );
    assert(removeOwnerRes.status === 403, 'Privilege Guard: ORG_ADMIN cannot remove ORG_OWNER (403 Forbidden)');

    // 6.17 ORG_OWNER manages permitted operational members -> 200 OK
    const ownerAddStaffRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      method: 'POST',
      headers: authHeader(orgOwnerToken),
      body: JSON.stringify({
        userId: USER_2_ID,
        role: OrgMemberRole.STAFF,
      }),
    });
    assert(ownerAddStaffRes.status === 200 || ownerAddStaffRes.status === 201, 'ORG_OWNER manages permitted members (200/201)');

    // ============================================================================
    // SUITE 7: PRESERVATION OF PROMPTS 1-6 HEALTH & AUTH ENDPOINTS
    // ============================================================================
    console.log('\n[Suite 7] Preservation of Existing Endpoints');

    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert(healthRes.status === 200, 'GET /api/health continues to return 200 OK');

    const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: authHeader(user1Token) });
    assert(meRes.status === 200, 'GET /api/auth/me continues to return 200 OK');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  const failed = results.filter((r) => !r.passed);
  console.log('\n================================================================');
  console.log(` Organization API Test Results: ${results.length - failed.length}/${results.length} PASSED`);
  if (failed.length > 0) {
    console.error(` Failed Tests (${failed.length}):`);
    failed.forEach((f) => console.error(`  - ${f.name}: ${f.error}`));
    console.log('================================================================\n');
    process.exit(1);
  } else {
    console.log(' ALL 30+ ORGANIZATION & MEMBER SECURITY TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  }
}

runOrgTests().catch((err) => {
  console.error('[CivicFix Org Test] Fatal unexpected error:', err);
  process.exit(1);
});
