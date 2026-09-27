import http from 'http';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
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

async function runRbacTests() {
  console.log('\n================================================================');
  console.log(' CivicFix - Role-Based Access Control (RBAC) Test Suite');
  console.log('================================================================\n');

  // Seeded User IDs (from backend/prisma/seed.ts)
  const PLATFORM_ADMIN_ID = 'f0000000-0000-0000-0000-000000000001';
  const ORG_OWNER_ID = 'f0000000-0000-0000-0000-000000000002';
  const ORG_ADMIN_ID = 'f0000000-0000-0000-0000-000000000003';
  const MANAGER_ID = 'f0000000-0000-0000-0000-000000000004';
  const STAFF_ID = 'f0000000-0000-0000-0000-000000000005';
  const USER_1_ID = 'f0000000-0000-0000-0000-000000000006';
  const USER_2_ID = 'f0000000-0000-0000-0000-000000000007';
  const DEACTIVATED_USER_ID = 'f0000000-0000-0000-0000-000000000099';

  // Seeded Organization & Department IDs
  const SRM_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
  const UNRELATED_ORG_ID = 'a0000000-0000-0000-0000-000000000099';
  const CIVIL_DEPT_ID = 'b0000000-0000-0000-0000-000000000001';
  const ELECTRICAL_DEPT_ID = 'b0000000-0000-0000-0000-000000000002';

  // Seeded Issue IDs
  const ELECTRICAL_ISSUE_ID = 'a1000000-0000-0000-0000-000000000001'; // reported by USER_1, assigned to ELECTRICAL
  const CIVIL_ISSUE_ID = 'a1000000-0000-0000-0000-000000000002'; // reported by USER_2, assigned to CIVIL
  const NONEXISTENT_ISSUE_ID = 'a1000000-0000-0000-0000-000000000099';

  // Generate Authentic Signed JWTs for Each Role
  const platformAdminToken = generateToken({ id: PLATFORM_ADMIN_ID, role: UserRole.PLATFORM_ADMIN });
  const orgOwnerToken = generateToken({ id: ORG_OWNER_ID, role: UserRole.ORG_OWNER });
  const orgAdminToken = generateToken({ id: ORG_ADMIN_ID, role: UserRole.ORG_ADMIN });
  const managerToken = generateToken({ id: MANAGER_ID, role: UserRole.MANAGER });
  const staffToken = generateToken({ id: STAFF_ID, role: UserRole.STAFF });
  const user1Token = generateToken({ id: USER_1_ID, role: UserRole.USER });
  const user2Token = generateToken({ id: USER_2_ID, role: UserRole.USER });
  const deactivatedToken = generateToken({ id: DEACTIVATED_USER_ID, role: UserRole.USER });

  // Spin up in-memory HTTP server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  try {
    // ============================================================================
    // SUITE 1: ROLE-BASED ACCESS CONTROL (requireRole, requireAnyRole)
    // ============================================================================
    console.log('[Suite 1] Role-Based Route Access Control');

    // 1.1 Platform endpoint requires PLATFORM_ADMIN
    const unauthPlat = await fetch(`${baseUrl}/api/auth/test/platform`);
    assert(unauthPlat.status === 401, 'Unauthenticated access to platform route returns 401');

    const userPlat = await fetch(`${baseUrl}/api/auth/test/platform`, { headers: authHeader(user1Token) });
    assert(userPlat.status === 403, 'USER denied from platform route (403 Forbidden)');

    const staffPlat = await fetch(`${baseUrl}/api/auth/test/platform`, { headers: authHeader(staffToken) });
    assert(staffPlat.status === 403, 'STAFF denied from platform route (403 Forbidden)');

    const adminPlat = await fetch(`${baseUrl}/api/auth/test/platform`, { headers: authHeader(orgAdminToken) });
    assert(adminPlat.status === 403, 'ORG_ADMIN denied from platform route (403 Forbidden)');

    const platPlat = await fetch(`${baseUrl}/api/auth/test/platform`, { headers: authHeader(platformAdminToken) });
    assert(platPlat.status === 200, 'PLATFORM_ADMIN allowed on platform route (200 OK)');

    // 1.2 Admin endpoint requires ORG_OWNER or ORG_ADMIN
    const userAdmin = await fetch(`${baseUrl}/api/auth/test/admin`, { headers: authHeader(user1Token) });
    assert(userAdmin.status === 403, 'USER denied from admin route (403 Forbidden)');

    const staffAdmin = await fetch(`${baseUrl}/api/auth/test/admin`, { headers: authHeader(staffToken) });
    assert(staffAdmin.status === 403, 'STAFF denied from admin route (403 Forbidden)');

    const orgAdminAdmin = await fetch(`${baseUrl}/api/auth/test/admin`, { headers: authHeader(orgAdminToken) });
    assert(orgAdminAdmin.status === 200, 'ORG_ADMIN allowed on admin route (200 OK)');

    const orgOwnerAdmin = await fetch(`${baseUrl}/api/auth/test/admin`, { headers: authHeader(orgOwnerToken) });
    assert(orgOwnerAdmin.status === 200, 'ORG_OWNER allowed on admin route (200 OK)');

    // 1.3 Manager endpoint requires MANAGER
    const staffManager = await fetch(`${baseUrl}/api/auth/test/manager`, { headers: authHeader(staffToken) });
    assert(staffManager.status === 403, 'STAFF denied from manager route (403 Forbidden)');

    const managerManager = await fetch(`${baseUrl}/api/auth/test/manager`, { headers: authHeader(managerToken) });
    assert(managerManager.status === 200, 'MANAGER allowed on manager route (200 OK)');

    // 1.4 Staff operational endpoint allows STAFF, MANAGER, ORG_ADMIN, ORG_OWNER
    const userStaff = await fetch(`${baseUrl}/api/auth/test/staff`, { headers: authHeader(user1Token) });
    assert(userStaff.status === 403, 'USER denied from staff route (403 Forbidden)');

    const staffStaff = await fetch(`${baseUrl}/api/auth/test/staff`, { headers: authHeader(staffToken) });
    assert(staffStaff.status === 200, 'STAFF allowed on staff route (200 OK)');

    const managerStaff = await fetch(`${baseUrl}/api/auth/test/staff`, { headers: authHeader(managerToken) });
    assert(managerStaff.status === 200, 'MANAGER allowed on staff route (200 OK)');

    // 1.5 User endpoint allows USER
    const userUser = await fetch(`${baseUrl}/api/auth/test/user`, { headers: authHeader(user1Token) });
    assert(userUser.status === 200, 'USER allowed on citizen user route (200 OK)');

    // ============================================================================
    // SUITE 2: ROLE TAMPERING & PRIVILEGE ESCALATION PROTECTION
    // ============================================================================
    console.log('\n[Suite 2] Role Tampering & Privilege Escalation Protection');

    // 2.1 USER attempts POST /admin-action with { role: "PLATFORM_ADMIN" } in body
    const bodyTamperRes = await fetch(`${baseUrl}/api/auth/test/admin-action`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({ role: 'PLATFORM_ADMIN', action: 'drop_database' }),
    });
    assert(bodyTamperRes.status === 403, 'Role Tampering Guard: Request body role claim ignored (403 Forbidden)');

    // 2.2 USER attempts GET /platform?role=PLATFORM_ADMIN query manipulation
    const queryTamperRes = await fetch(`${baseUrl}/api/auth/test/platform?role=PLATFORM_ADMIN`, {
      headers: authHeader(user1Token),
    });
    assert(queryTamperRes.status === 403, 'Query Tampering Guard: URL query role claim ignored (403 Forbidden)');

    // 2.3 Forged token signed with attacker secret key
    const attackerToken = jwt.sign(
      { sub: USER_1_ID, role: UserRole.PLATFORM_ADMIN },
      'attacker-fake-secret-key-123456789'
    );
    const forgedTokenRes = await fetch(`${baseUrl}/api/auth/test/platform`, {
      headers: authHeader(attackerToken),
    });
    assert(forgedTokenRes.status === 401, 'Forged JWT signature rejected (401 Unauthorized)');

    // 2.4 Deactivated user token rejected even if JWT was originally valid
    const deactivatedRes = await fetch(`${baseUrl}/api/auth/test/user`, {
      headers: authHeader(deactivatedToken),
    });
    assert(deactivatedRes.status === 401, 'Deactivated database account rejected (401 Unauthorized)');

    // ============================================================================
    // SUITE 3: ORGANIZATION-SCOPED ISOLATION (requireOrganizationAccess)
    // ============================================================================
    console.log('\n[Suite 3] Organization-Scoped Isolation');

    // 3.1 Malformed organization UUID
    const badOrgRes = await fetch(`${baseUrl}/api/auth/test/organizations/not-a-uuid`, {
      headers: authHeader(orgAdminToken),
    });
    assert(badOrgRes.status === 400, 'Malformed organization UUID parameter rejected with 400');

    // 3.2 Public USER has no organization admin access
    const userOrgRes = await fetch(`${baseUrl}/api/auth/test/organizations/${SRM_ORG_ID}`, {
      headers: authHeader(user1Token),
    });
    assert(userOrgRes.status === 403, 'USER denied from organization resource (403 Forbidden)');

    // 3.3 ORG_ADMIN accesses own organization -> 200 OK
    const adminOwnOrg = await fetch(`${baseUrl}/api/auth/test/organizations/${SRM_ORG_ID}`, {
      headers: authHeader(orgAdminToken),
    });
    assert(adminOwnOrg.status === 200, 'ORG_ADMIN permitted on own organization (200 OK)');

    // 3.4 ORG_ADMIN accesses another organization -> 403 Forbidden
    const adminOtherOrg = await fetch(`${baseUrl}/api/auth/test/organizations/${UNRELATED_ORG_ID}`, {
      headers: authHeader(orgAdminToken),
    });
    assert(adminOtherOrg.status === 403, 'Org Isolation: ORG_ADMIN denied on unrelated organization (403 Forbidden)');

    // 3.5 ORG_OWNER accesses own organization -> 200 OK
    const ownerOwnOrg = await fetch(`${baseUrl}/api/auth/test/organizations/${SRM_ORG_ID}`, {
      headers: authHeader(orgOwnerToken),
    });
    assert(ownerOwnOrg.status === 200, 'ORG_OWNER permitted on own organization (200 OK)');

    // 3.6 ORG_OWNER accesses another organization -> 403 Forbidden
    const ownerOtherOrg = await fetch(`${baseUrl}/api/auth/test/organizations/${UNRELATED_ORG_ID}`, {
      headers: authHeader(orgOwnerToken),
    });
    assert(ownerOtherOrg.status === 403, 'Org Isolation: ORG_OWNER denied on unrelated organization (403 Forbidden)');

    // 3.7 PLATFORM_ADMIN override access across organizations -> 200 OK
    const platOrgRes = await fetch(`${baseUrl}/api/auth/test/organizations/${SRM_ORG_ID}`, {
      headers: authHeader(platformAdminToken),
    });
    assert(platOrgRes.status === 200, 'PLATFORM_ADMIN override permitted on organization (200 OK)');

    // ============================================================================
    // SUITE 4: DEPARTMENT-SCOPED ISOLATION (requireDepartmentAccess)
    // ============================================================================
    console.log('\n[Suite 4] Department-Scoped Isolation');

    // 4.1 Malformed department UUID
    const badDeptRes = await fetch(`${baseUrl}/api/auth/test/departments/not-a-uuid`, {
      headers: authHeader(staffToken),
    });
    assert(badDeptRes.status === 400, 'Malformed department UUID parameter rejected with 400');

    // 4.2 USER denied department access
    const userDeptRes = await fetch(`${baseUrl}/api/auth/test/departments/${ELECTRICAL_DEPT_ID}`, {
      headers: authHeader(user1Token),
    });
    assert(userDeptRes.status === 403, 'USER denied from department operational resource (403 Forbidden)');

    // 4.3 STAFF assigned to Electrical accessing Electrical department -> 200 OK
    const staffOwnDept = await fetch(`${baseUrl}/api/auth/test/departments/${ELECTRICAL_DEPT_ID}`, {
      headers: authHeader(staffToken),
    });
    assert(staffOwnDept.status === 200, 'STAFF permitted on assigned department (200 OK)');

    // 4.4 STAFF assigned to Electrical accessing Civil department -> 403 Forbidden
    const staffOtherDept = await fetch(`${baseUrl}/api/auth/test/departments/${CIVIL_DEPT_ID}`, {
      headers: authHeader(staffToken),
    });
    assert(staffOtherDept.status === 403, 'Dept Isolation: STAFF denied on unassigned department (403 Forbidden)');

    // 4.5 MANAGER assigned to Civil accessing Civil department -> 200 OK
    const managerOwnDept = await fetch(`${baseUrl}/api/auth/test/departments/${CIVIL_DEPT_ID}`, {
      headers: authHeader(managerToken),
    });
    assert(managerOwnDept.status === 200, 'MANAGER permitted on assigned department (200 OK)');

    // 4.6 MANAGER assigned to Civil accessing Electrical department -> 403 Forbidden
    const managerOtherDept = await fetch(`${baseUrl}/api/auth/test/departments/${ELECTRICAL_DEPT_ID}`, {
      headers: authHeader(managerToken),
    });
    assert(managerOtherDept.status === 403, 'Dept Isolation: MANAGER denied on unassigned department (403 Forbidden)');

    // 4.7 ORG_ADMIN accessing child department -> 200 OK
    const adminDeptRes = await fetch(`${baseUrl}/api/auth/test/departments/${CIVIL_DEPT_ID}`, {
      headers: authHeader(orgAdminToken),
    });
    assert(adminDeptRes.status === 200, 'ORG_ADMIN permitted on child department (200 OK)');

    // ============================================================================
    // SUITE 5: USER-SCOPED RESOURCE OWNERSHIP (requireUserOwnership)
    // ============================================================================
    console.log('\n[Suite 5] User Data Ownership & Horizontal Privilege Escalation Guards');

    // 5.1 Malformed user UUID
    const badUserParam = await fetch(`${baseUrl}/api/auth/test/users/not-a-uuid/data`, {
      headers: authHeader(user1Token),
    });
    assert(badUserParam.status === 400, 'Malformed user UUID parameter rejected with 400');

    // 5.2 USER 1 accessing own data -> 200 OK
    const userOwnData = await fetch(`${baseUrl}/api/auth/test/users/${USER_1_ID}/data`, {
      headers: authHeader(user1Token),
    });
    assert(userOwnData.status === 200, 'USER permitted to access own data (200 OK)');

    // 5.3 USER 1 attempting to access USER 2's data -> 403 Forbidden
    const userOtherData = await fetch(`${baseUrl}/api/auth/test/users/${USER_2_ID}/data`, {
      headers: authHeader(user1Token),
    });
    assert(userOtherData.status === 403, 'Horizontal Isolation: USER 1 denied access to USER 2 data (403 Forbidden)');

    // 5.4 USER 2 accessing own data -> 200 OK
    const user2OwnData = await fetch(`${baseUrl}/api/auth/test/users/${USER_2_ID}/data`, {
      headers: authHeader(user2Token),
    });
    assert(user2OwnData.status === 200, 'USER 2 permitted to access own data (200 OK)');

    // ============================================================================
    // SUITE 6: ISSUE ACCESS RIGHTS (requireIssueAccess)
    // ============================================================================
    console.log('\n[Suite 6] Issue-Scoped Access Rights & Assignment Checks');

    // 6.1 Non-existent issue returns 404
    const nonExistentIssue = await fetch(`${baseUrl}/api/auth/test/issues/${NONEXISTENT_ISSUE_ID}`, {
      headers: authHeader(user1Token),
    });
    assert(nonExistentIssue.status === 404, 'Non-existent issue returns 404 Not Found');

    // 6.2 USER 1 accessing own reported issue -> 200 OK
    const userOwnIssue = await fetch(`${baseUrl}/api/auth/test/issues/${ELECTRICAL_ISSUE_ID}`, {
      headers: authHeader(user1Token),
    });
    assert(userOwnIssue.status === 200, 'Issue Reporter permitted to access own reported issue (200 OK)');

    // 6.3 USER 2 accessing USER 1's issue -> 403 Forbidden
    const userOtherIssue = await fetch(`${baseUrl}/api/auth/test/issues/${ELECTRICAL_ISSUE_ID}`, {
      headers: authHeader(user2Token),
    });
    assert(userOtherIssue.status === 403, 'Issue Isolation: Other USER denied access to private issue (403 Forbidden)');

    // 6.4 ORG_ADMIN of SRM accessing SRM issue -> 200 OK
    const orgAdminIssue = await fetch(`${baseUrl}/api/auth/test/issues/${ELECTRICAL_ISSUE_ID}`, {
      headers: authHeader(orgAdminToken),
    });
    assert(orgAdminIssue.status === 200, 'ORG_ADMIN permitted on organization issue (200 OK)');

    // 6.5 STAFF assigned to Electrical department accessing Electrical issue -> 200 OK
    const staffAssignedIssue = await fetch(`${baseUrl}/api/auth/test/issues/${ELECTRICAL_ISSUE_ID}`, {
      headers: authHeader(staffToken),
    });
    assert(staffAssignedIssue.status === 200, 'STAFF permitted on issue assigned to their department (200 OK)');

    // 6.6 MANAGER of Civil department accessing Electrical issue (unassigned) -> 403 Forbidden
    const managerUnassignedIssue = await fetch(`${baseUrl}/api/auth/test/issues/${ELECTRICAL_ISSUE_ID}`, {
      headers: authHeader(managerToken),
    });
    assert(managerUnassignedIssue.status === 403, 'Dept Isolation: MANAGER denied on unassigned department issue (403 Forbidden)');

    // 6.7 MANAGER of Civil department accessing Civil issue -> 200 OK
    const managerCivilIssue = await fetch(`${baseUrl}/api/auth/test/issues/${CIVIL_ISSUE_ID}`, {
      headers: authHeader(managerToken),
    });
    assert(managerCivilIssue.status === 200, 'MANAGER permitted on issue assigned to their department (200 OK)');

    // ============================================================================
    // SUITE 7: PRESERVATION OF PROMPT 1-5 HEALTH & AUTH ENDPOINTS
    // ============================================================================
    console.log('\n[Suite 7] Preservation of Prompt 1–5 Working Endpoints');

    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert(healthRes.status === 200, 'GET /api/health continues to return 200 OK');

    const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: authHeader(user1Token) });
    assert(meRes.status === 200, 'GET /api/auth/me continues to return 200 OK for authenticated user');

    const meUnauth = await fetch(`${baseUrl}/api/auth/me`);
    assert(meUnauth.status === 401, 'GET /api/auth/me returns 401 Unauthorized when unauthenticated');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  const failed = results.filter((r) => !r.passed);
  console.log('\n================================================================');
  console.log(` RBAC Test Results: ${results.length - failed.length}/${results.length} PASSED`);
  if (failed.length > 0) {
    console.error(` Failed Tests (${failed.length}):`);
    failed.forEach((f) => console.error(`  - ${f.name}: ${f.error}`));
    console.log('================================================================\n');
    process.exit(1);
  } else {
    console.log(' ALL 35+ RBAC & AUTHORIZATION TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  }
}

runRbacTests().catch((err) => {
  console.error('[CivicFix RBAC Test] Fatal unexpected error:', err);
  process.exit(1);
});
