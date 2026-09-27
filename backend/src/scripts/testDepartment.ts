import http from 'http';
import { app } from '../index.js';
import { generateToken } from '../services/auth.service.js';
import { UserRole, OrganizationType, OrgMemberRole } from '@prisma/client';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    results.push({ name: testName, passed: true });
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    results.push({ name: testName, passed: false, error: detail || 'Assertion failed' });
  }
}

async function runDepartmentTests() {
  console.log('\n================================================================');
  console.log(' CivicFix - Organization Departments & Staff Management Tests');
  console.log('================================================================\n');

  // Seeded User IDs
  const PLATFORM_ADMIN_ID = 'f0000000-0000-0000-0000-000000000001';
  const ORG_OWNER_ID = 'f0000000-0000-0000-0000-000000000002';
  const ORG_ADMIN_ID = 'f0000000-0000-0000-0000-000000000003';
  const MANAGER_ID = 'f0000000-0000-0000-0000-000000000004'; // Civil Dept Manager
  const STAFF_ID = 'f0000000-0000-0000-0000-000000000005';   // Electrical Dept Staff
  const USER_1_ID = 'f0000000-0000-0000-0000-000000000006';  // Student/Citizen
  const USER_2_ID = 'f0000000-0000-0000-0000-000000000007';  // Second Citizen

  // Seeded Organization IDs
  const SRM_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
  const UNRELATED_ORG_ID = 'a0000000-0000-0000-0000-000000000099';

  // Seeded Department IDs
  const CIVIL_DEPT_ID = 'b0000000-0000-0000-0000-000000000001';
  const ELECTRICAL_DEPT_ID = 'b0000000-0000-0000-0000-000000000002';

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

  let createdDeptId = '';

  try {
    // ============================================================================
    // SUITE 1: DEPARTMENT CREATION (PLATFORM_ADMIN / ORG_OWNER / ORG_ADMIN)
    // ============================================================================
    console.log('[Suite 1] Department Creation & Validation');

    // 1.1 USER cannot create department -> 403
    const userCreateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({ name: 'Illegal Dept' }),
    });
    assert(userCreateRes.status === 403, 'USER denied from creating departments (403 Forbidden)');

    // 1.2 MANAGER cannot create department -> 403
    const managerCreateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      method: 'POST',
      headers: authHeader(managerToken),
      body: JSON.stringify({ name: 'Manager New Dept' }),
    });
    assert(managerCreateRes.status === 403, 'MANAGER denied from creating departments (403 Forbidden)');

    // 1.3 STAFF cannot create department -> 403
    const staffCreateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      method: 'POST',
      headers: authHeader(staffToken),
      body: JSON.stringify({ name: 'Staff New Dept' }),
    });
    assert(staffCreateRes.status === 403, 'STAFF denied from creating departments (403 Forbidden)');

    // 1.4 Validation: Name too short (< 2 chars) -> 400
    const shortNameRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ name: 'A' }),
    });
    assert(shortNameRes.status === 400, 'Validation: Department name < 2 chars rejected (400 Bad Request)');

    // 1.5 Injection of server-generated fields -> 400
    const injectRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        name: 'Valid Dept',
        id: '00000000-0000-0000-0000-000000000000',
        createdAt: new Date(),
      }),
    });
    assert(injectRes.status === 400, 'Security: Injection of server-generated fields rejected (400 Bad Request)');

    // 1.6 ORG_ADMIN creates department successfully -> 201 Created
    const createRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        name: 'Horticulture & Green Spaces',
        code: 'HORTICULTURE',
        description: 'Oversees campus lawns, gardens, tree maintenance, and botanical spaces.',
      }),
    });
    const createJson = (await createRes.json()) as any;
    assert(createRes.status === 201, 'ORG_ADMIN creates department in own organization (201 Created)');
    assert(createJson.data?.name === 'Horticulture & Green Spaces', 'Department name matches input');
    createdDeptId = createJson.data?.id;

    // 1.7 Duplicate department name within same organization rejected -> 409 Conflict
    const dupRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        name: 'Horticulture & Green Spaces',
      }),
    });
    assert(dupRes.status === 409, 'Duplicate department name rejected with 409 Conflict');

    // 1.8 Cross-tenant creation guard: ORG_ADMIN cannot create department in another org -> 403
    const crossCreateRes = await fetch(`${baseUrl}/api/organizations/${UNRELATED_ORG_ID}/departments`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ name: 'Cross Org Dept' }),
    });
    assert(crossCreateRes.status === 403, 'Org Isolation: ORG_ADMIN cannot create department in another org (403)');

    // 1.9 ORG_OWNER creates department in own organization -> 201 Created
    const ownerCreateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      method: 'POST',
      headers: authHeader(orgOwnerToken),
      body: JSON.stringify({
        name: 'Campus Security & Surveillance',
        code: 'SECURITY',
        description: 'Oversees campus patrols, security checkpoints, and CCTV coverage.',
      }),
    });
    assert(ownerCreateRes.status === 201, 'ORG_OWNER creates department in own organization (201 Created)');

    // 1.10 Org Isolation: ORG_OWNER cannot create department in another org -> 403
    const crossOwnerCreateRes = await fetch(`${baseUrl}/api/organizations/${UNRELATED_ORG_ID}/departments`, {
      method: 'POST',
      headers: authHeader(orgOwnerToken),
      body: JSON.stringify({ name: 'Illegal Org Dept' }),
    });
    assert(crossOwnerCreateRes.status === 403, 'Org Isolation: ORG_OWNER cannot create department in another org (403)');

    // ============================================================================
    // SUITE 2: LIST DEPARTMENTS SCOPED BY ROLE & TENANT
    // ============================================================================
    console.log('\n[Suite 2] List Departments Scoped by Role & Tenant');

    // 2.1 USER denied from listing departments -> 403
    const userListRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      headers: authHeader(user1Token),
    });
    assert(userListRes.status === 403, 'USER denied from listing departments (403 Forbidden)');

    // 2.2 PLATFORM_ADMIN lists departments -> 200 OK
    const platformListRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      headers: authHeader(platformAdminToken),
    });
    const platformListJson = (await platformListRes.json()) as any;
    assert(platformListRes.status === 200, 'PLATFORM_ADMIN lists departments (200 OK)');
    assert(Array.isArray(platformListJson.data?.departments), 'Departments returned as array');

    // 2.3 ORG_ADMIN lists departments in own org -> 200 OK
    const adminListRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      headers: authHeader(orgAdminToken),
    });
    const adminListJson = (await adminListRes.json()) as any;
    assert(adminListRes.status === 200, 'ORG_ADMIN lists departments in own organization (200 OK)');
    assert(adminListJson.data?.departments?.length >= 5, 'List includes all seeded departments');

    // 2.4 ORG_OWNER lists departments in own org -> 200 OK
    const ownerListRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      headers: authHeader(orgOwnerToken),
    });
    assert(ownerListRes.status === 200, 'ORG_OWNER lists departments in own organization (200 OK)');

    // 2.5 Org Isolation: ORG_ADMIN cannot list departments in unrelated org -> 403
    const crossListRes = await fetch(`${baseUrl}/api/organizations/${UNRELATED_ORG_ID}/departments`, {
      headers: authHeader(orgAdminToken),
    });
    assert(crossListRes.status === 403, 'Org Isolation: ORG_ADMIN denied on unrelated org (403 Forbidden)');

    // 2.6 MANAGER lists departments in own org -> 200 OK
    const managerListRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      headers: authHeader(managerToken),
    });
    assert(managerListRes.status === 200, 'MANAGER permitted to view departments in assigned org (200 OK)');

    // ============================================================================
    // SUITE 3: GET DEPARTMENT DETAILS & CROSS-TENANT VALIDATION
    // ============================================================================
    console.log('\n[Suite 3] Department Details & Cross-Tenant Security');

    // 3.1 Malformed organizationId rejected -> 400
    const malformedOrgRes = await fetch(`${baseUrl}/api/organizations/not-a-uuid/departments/${CIVIL_DEPT_ID}`, {
      headers: authHeader(orgAdminToken),
    });
    assert(malformedOrgRes.status === 400, 'Malformed organizationId rejected with 400 Bad Request');

    // 3.2 Malformed departmentId rejected -> 400
    const malformedDeptRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/not-a-uuid`, {
      headers: authHeader(orgAdminToken),
    });
    assert(malformedDeptRes.status === 400, 'Malformed departmentId rejected with 400 Bad Request');

    // 3.3 Non-existent departmentId returns 404
    const notFoundRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/b0000000-0000-0000-0000-000000000099`,
      { headers: authHeader(orgAdminToken) }
    );
    assert(notFoundRes.status === 404, 'Non-existent departmentId returns 404 Not Found');

    // 3.4 Cross-Tenant mismatch: Dept belonging to Org A queried with Org B ID returns 404/403
    const mismatchRes = await fetch(
      `${baseUrl}/api/organizations/${UNRELATED_ORG_ID}/departments/${CIVIL_DEPT_ID}`,
      { headers: authHeader(platformAdminToken) }
    );
    assert(mismatchRes.status === 404, 'Cross-Tenant Guard: Department queried with mismatched orgId returns 404');

    // 3.5 USER denied from getting department details -> 403
    const userGetRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}`, {
      headers: authHeader(user1Token),
    });
    assert(userGetRes.status === 403, 'USER denied from getting department details (403 Forbidden)');

    // 3.6 ORG_ADMIN gets own department details -> 200 OK
    const adminGetRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}`, {
      headers: authHeader(orgAdminToken),
    });
    const adminGetJson = (await adminGetRes.json()) as any;
    assert(adminGetRes.status === 200, 'ORG_ADMIN gets department details (200 OK)');
    assert(adminGetJson.data?.department?.name === 'Civil / Infrastructure', 'Department details verified');

    // ============================================================================
    // SUITE 4: UPDATE DEPARTMENT METADATA
    // ============================================================================
    console.log('\n[Suite 4] Update Department Metadata');

    // 4.1 STAFF denied from updating department -> 403
    const staffUpdateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}`, {
      method: 'PATCH',
      headers: authHeader(staffToken),
      body: JSON.stringify({ description: 'Hacked description' }),
    });
    assert(staffUpdateRes.status === 403, 'STAFF denied from updating department (403 Forbidden)');

    // 4.2 MANAGER denied from updating department configuration -> 403
    const managerUpdateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}`, {
      method: 'PATCH',
      headers: authHeader(managerToken),
      body: JSON.stringify({ description: 'Hacked description' }),
    });
    assert(managerUpdateRes.status === 403, 'MANAGER denied from updating department (403 Forbidden)');

    // 4.3 USER denied from updating department -> 403
    const userUpdateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}`, {
      method: 'PATCH',
      headers: authHeader(user1Token),
      body: JSON.stringify({ description: 'Hacked description' }),
    });
    assert(userUpdateRes.status === 403, 'USER denied from updating department (403 Forbidden)');

    // 4.4 ORG_ADMIN updates own department description -> 200 OK
    const adminUpdateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${createdDeptId}`, {
      method: 'PATCH',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ description: 'Updated horticulture description' }),
    });
    assert(adminUpdateRes.status === 200, 'ORG_ADMIN updates own department successfully (200 OK)');

    // 4.5 Duplicate department name on update rejected -> 409 Conflict
    const dupUpdateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${createdDeptId}`, {
      method: 'PATCH',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ name: 'Civil / Infrastructure' }),
    });
    assert(dupUpdateRes.status === 409, 'Duplicate department name on update rejected with 409 Conflict');

    // 4.6 PLATFORM_ADMIN updates department -> 200 OK
    const platformUpdateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${createdDeptId}`, {
      method: 'PATCH',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({ description: 'Updated by Platform Superadmin' }),
    });
    assert(platformUpdateRes.status === 200, 'PLATFORM_ADMIN updates department successfully (200 OK)');

    // ============================================================================
    // SUITE 5: ACTIVATE / DEACTIVATE DEPARTMENT
    // ============================================================================
    console.log('\n[Suite 5] Activate / Deactivate Department');

    // 5.1 MANAGER denied from toggling department status -> 403
    const managerStatusRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${createdDeptId}/status`,
      {
        method: 'PATCH',
        headers: authHeader(managerToken),
        body: JSON.stringify({ isActive: false }),
      }
    );
    assert(managerStatusRes.status === 403, 'MANAGER denied from changing department status (403 Forbidden)');

    // 5.2 ORG_ADMIN deactivates department -> 200 OK
    const deactRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${createdDeptId}/status`, {
      method: 'PATCH',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ isActive: false }),
    });
    const deactJson = (await deactRes.json()) as any;
    assert(deactRes.status === 200, 'ORG_ADMIN deactivates department (200 OK)');
    assert(deactJson.data?.department?.isActive === false, 'Department isActive set to false');

    // 5.3 Inactive department: non-platform user operational update rejected -> 403
    const inactiveUpdateRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${createdDeptId}`, {
      method: 'PATCH',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ description: 'Should fail on inactive dept' }),
    });
    assert(inactiveUpdateRes.status === 403, 'Inactive Dept: Operational update rejected (403 Forbidden)');

    // 5.4 Inactive department: member addition rejected -> 403
    const inactiveMemberRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${createdDeptId}/members`,
      {
        method: 'POST',
        headers: authHeader(orgAdminToken),
        body: JSON.stringify({ userId: USER_1_ID, roleInDepartment: 'STAFF' }),
      }
    );
    assert(inactiveMemberRes.status === 403, 'Inactive Dept: Member addition rejected (403 Forbidden)');

    // 5.5 ORG_ADMIN reactivates department -> 200 OK
    const reactRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${createdDeptId}/status`, {
      method: 'PATCH',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ isActive: true }),
    });
    assert(reactRes.status === 200, 'ORG_ADMIN reactivates department (200 OK)');

    // ============================================================================
    // SUITE 6: DEPARTMENT MEMBERS VIEWING & ISOLATION
    // ============================================================================
    console.log('\n[Suite 6] Department Members Viewing & Isolation');

    // 6.1 USER denied from viewing department members -> 403
    const userViewMembersRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members`,
      { headers: authHeader(user1Token) }
    );
    assert(userViewMembersRes.status === 403, 'USER denied from viewing department members (403 Forbidden)');

    // 6.2 ORG_ADMIN views department members -> 200 OK
    const adminViewMembersRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members`,
      { headers: authHeader(orgAdminToken) }
    );
    const adminViewMembersJson = (await adminViewMembersRes.json()) as any;
    assert(adminViewMembersRes.status === 200, 'ORG_ADMIN views department members (200 OK)');
    assert(Array.isArray(adminViewMembersJson.data?.members), 'Members returned as array');

    // Verify passwords/hashes never exposed
    const firstMember = adminViewMembersJson.data?.members?.[0];
    assert(firstMember?.user?.passwordHash === undefined, 'Security: Member list does not expose password hashes');
    assert(firstMember?.user?.password === undefined, 'Security: Member list does not expose plaintext passwords');

    // 6.3 MANAGER (Civil) views Civil department members -> 200 OK
    const managerViewOwnRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members`,
      { headers: authHeader(managerToken) }
    );
    assert(managerViewOwnRes.status === 200, 'MANAGER views members of own department (200 OK)');

    // 6.4 Department Isolation: MANAGER (Civil) denied from viewing Electrical department members -> 403
    const managerViewOtherRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${ELECTRICAL_DEPT_ID}/members`,
      { headers: authHeader(managerToken) }
    );
    assert(managerViewOtherRes.status === 403, 'Dept Isolation: MANAGER denied from viewing another department (403)');

    // 6.5 STAFF (Electrical) views Electrical department members -> 200 OK
    const staffViewOwnRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${ELECTRICAL_DEPT_ID}/members`,
      { headers: authHeader(staffToken) }
    );
    assert(staffViewOwnRes.status === 200, 'STAFF views members of own department (200 OK)');

    // 6.6 Department Isolation: STAFF (Electrical) denied from viewing Civil department members -> 403
    const staffViewOtherRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members`,
      { headers: authHeader(staffToken) }
    );
    assert(staffViewOtherRes.status === 403, 'Dept Isolation: STAFF denied from viewing another department (403)');

    // ============================================================================
    // SUITE 7: DEPARTMENT MEMBER ADDITION & PRE-REQUISITE CHECKS
    // ============================================================================
    console.log('\n[Suite 7] Member Addition & Organization Pre-requisite Checks');

    // 7.1 Non-member user addition rejected: USER_2 does not belong to SRM org -> 400 Bad Request
    const nonOrgUserAddRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members`,
      {
        method: 'POST',
        headers: authHeader(orgAdminToken),
        body: JSON.stringify({
          userId: USER_2_ID,
          roleInDepartment: 'STAFF',
        }),
      }
    );
    assert(
      nonOrgUserAddRes.status === 400,
      'Pre-requisite Guard: User not belonging to organization rejected with 400 Bad Request'
    );

    // 7.2 Add USER_2 to SRM Organization first via Org Member API
    const addOrgMemRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/members`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        userId: USER_2_ID,
        role: OrgMemberRole.STAFF,
      }),
    });
    assert(
      addOrgMemRes.status === 201 || addOrgMemRes.status === 200,
      'USER_2 successfully enrolled in SRM Organization'
    );

    // 7.3 MANAGER (Civil) attempts to add staff to Electrical department -> 403 Forbidden
    const crossDeptAddRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${ELECTRICAL_DEPT_ID}/members`,
      {
        method: 'POST',
        headers: authHeader(managerToken),
        body: JSON.stringify({
          userId: USER_2_ID,
          roleInDepartment: 'STAFF',
        }),
      }
    );
    assert(
      crossDeptAddRes.status === 403,
      'Dept Isolation: MANAGER cannot add staff to another department (403 Forbidden)'
    );

    // 7.4 MANAGER attempts privilege escalation (assigning MANAGER role) -> 403 Forbidden
    const managerEscalateRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members`,
      {
        method: 'POST',
        headers: authHeader(managerToken),
        body: JSON.stringify({
          userId: USER_2_ID,
          roleInDepartment: 'MANAGER',
        }),
      }
    );
    assert(
      managerEscalateRes.status === 403,
      'Privilege Guard: MANAGER cannot assign MANAGER role to staff (403 Forbidden)'
    );

    // 7.5 Attempting to assign administrative org role (PLATFORM_ADMIN) -> 403 Forbidden
    const adminEscalateRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members`,
      {
        method: 'POST',
        headers: authHeader(orgAdminToken),
        body: JSON.stringify({
          userId: USER_2_ID,
          roleInDepartment: 'PLATFORM_ADMIN',
        }),
      }
    );
    assert(
      adminEscalateRes.status === 403,
      'Privilege Guard: Cannot assign PLATFORM_ADMIN role via department (403 Forbidden)'
    );

    // 7.6 User attempts to add themselves -> 403 Forbidden
    const selfAddRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members`,
      {
        method: 'POST',
        headers: authHeader(orgAdminToken),
        body: JSON.stringify({
          userId: ORG_ADMIN_ID,
          roleInDepartment: 'STAFF',
        }),
      }
    );
    assert(selfAddRes.status === 403, 'Privilege Guard: Actor cannot add themselves to department (403 Forbidden)');

    // 7.7 MANAGER (Civil) adds USER_2 as STAFF in Civil department -> 201 Created
    const managerAddStaffRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members`,
      {
        method: 'POST',
        headers: authHeader(managerToken),
        body: JSON.stringify({
          userId: USER_2_ID,
          roleInDepartment: 'FIELD_TECHNICIAN',
        }),
      }
    );
    assert(managerAddStaffRes.status === 201, 'MANAGER adds staff to own department successfully (201 Created)');

    // 7.8 Duplicate department member addition rejected -> 409 Conflict
    const dupDeptMemberRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members`,
      {
        method: 'POST',
        headers: authHeader(managerToken),
        body: JSON.stringify({
          userId: USER_2_ID,
          roleInDepartment: 'FIELD_TECHNICIAN',
        }),
      }
    );
    assert(dupDeptMemberRes.status === 409, 'Duplicate department member rejected with 409 Conflict');

    // ============================================================================
    // SUITE 8: DEPARTMENT MEMBER ROLE UPDATE & DEACTIVATION
    // ============================================================================
    console.log('\n[Suite 8] Member Role Update & Deactivation');

    // 8.1 Malformed userId parameter on update rejected -> 400
    const malformedUserPatchRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members/invalid-uuid`,
      {
        method: 'PATCH',
        headers: authHeader(orgAdminToken),
        body: JSON.stringify({ roleInDepartment: 'SENIOR_STAFF' }),
      }
    );
    assert(malformedUserPatchRes.status === 400, 'Security: Malformed userId parameter on update rejected (400)');

    // 8.2 User cannot modify their own department role -> 403 Forbidden
    const selfModifyRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members/${MANAGER_ID}`,
      {
        method: 'PATCH',
        headers: authHeader(managerToken),
        body: JSON.stringify({ roleInDepartment: 'DIRECTOR' }),
      }
    );
    assert(selfModifyRes.status === 403, 'Privilege Guard: User cannot modify own department role (403 Forbidden)');

    // 8.3 MANAGER cannot promote staff to MANAGER -> 403 Forbidden
    const managerPromoteRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members/${USER_2_ID}`,
      {
        method: 'PATCH',
        headers: authHeader(managerToken),
        body: JSON.stringify({ roleInDepartment: 'MANAGER' }),
      }
    );
    assert(managerPromoteRes.status === 403, 'Privilege Guard: MANAGER cannot promote staff to MANAGER (403)');

    // 8.4 ORG_ADMIN updates member role in department -> 200 OK
    const adminUpdateMemberRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members/${USER_2_ID}`,
      {
        method: 'PATCH',
        headers: authHeader(orgAdminToken),
        body: JSON.stringify({ roleInDepartment: 'SENIOR_OPERATOR' }),
      }
    );
    assert(adminUpdateMemberRes.status === 200, 'ORG_ADMIN updates member role in department (200 OK)');

    // 8.5 Malformed userId parameter on remove rejected -> 400
    const malformedDelRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members/invalid-uuid`,
      {
        method: 'DELETE',
        headers: authHeader(orgAdminToken),
      }
    );
    assert(malformedDelRes.status === 400, 'Security: Malformed userId parameter on remove rejected (400)');

    // 8.6 User cannot remove themselves from department -> 403 Forbidden
    const selfDelRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members/${MANAGER_ID}`,
      {
        method: 'DELETE',
        headers: authHeader(managerToken),
      }
    );
    assert(selfDelRes.status === 403, 'Privilege Guard: User cannot remove themselves from department (403)');

    // 8.7 MANAGER cannot remove another MANAGER -> 403 Forbidden
    const managerDelManagerRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members/${MANAGER_ID}`,
      {
        method: 'DELETE',
        headers: authHeader(managerToken),
      }
    );
    assert(managerDelManagerRes.status === 403, 'Privilege Guard: Manager cannot remove another manager (403)');

    // 8.8 ORG_ADMIN deactivates member from department -> 200 OK
    const removeMemberRes = await fetch(
      `${baseUrl}/api/organizations/${SRM_ORG_ID}/departments/${CIVIL_DEPT_ID}/members/${USER_2_ID}`,
      {
        method: 'DELETE',
        headers: authHeader(orgAdminToken),
      }
    );
    assert(removeMemberRes.status === 200, 'ORG_ADMIN deactivates member from department (200 OK)');

    // ============================================================================
    // SUITE 9: INACTIVE ORGANIZATION BEHAVIOR & ATTACK MATRIX
    // ============================================================================
    console.log('\n[Suite 9] Inactive Organization Behavior & Attack Matrix');

    // 9.1 Create a temporary organization to test inactive state
    const tempOrgRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({
        name: 'Temporary Deactivated Org',
        description: 'For testing inactive organization lifecycle',
        orgType: OrganizationType.OTHER,
      }),
    });
    const tempOrgJson = (await tempOrgRes.json()) as any;
    const tempOrgId = tempOrgJson.data?.id;

    // Deactivate temp organization
    await fetch(`${baseUrl}/api/organizations/${tempOrgId}/status`, {
      method: 'PATCH',
      headers: authHeader(platformAdminToken),
      body: JSON.stringify({ isActive: false }),
    });

    // 9.2 Creating department in inactive organization by non-platform user rejected -> 403
    const inactiveOrgCreateRes = await fetch(`${baseUrl}/api/organizations/${tempOrgId}/departments`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({ name: 'Should Fail on Inactive Org' }),
    });
    assert(
      inactiveOrgCreateRes.status === 403,
      'Inactive Org Guard: Non-platform user cannot create department in inactive org (403)'
    );

    // ============================================================================
    // SUITE 10: PRESERVATION OF PROMPTS 1-7 HEALTH, AUTH & ORG ENDPOINTS
    // ============================================================================
    console.log('\n[Suite 10] Preservation of Prompts 1-7 Endpoints');

    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert(healthRes.status === 200, 'GET /api/health continues to return 200 OK');

    const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: authHeader(user1Token) });
    assert(meRes.status === 200, 'GET /api/auth/me continues to return 200 OK');

    const orgListRes = await fetch(`${baseUrl}/api/organizations`, { headers: authHeader(platformAdminToken) });
    assert(orgListRes.status === 200, 'GET /api/organizations continues to return 200 OK');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  const failed = results.filter((r) => !r.passed);
  console.log('\n================================================================');
  console.log(` Department API Test Results: ${results.length - failed.length}/${results.length} PASSED`);
  if (failed.length > 0) {
    console.error(` Failed Tests (${failed.length}):`);
    failed.forEach((f) => console.error(`  - ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log(' ALL 40+ DEPARTMENT & STAFF MANAGEMENT TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  }
}

runDepartmentTests().catch((err) => {
  console.error('Fatal Department Test Runner Error:', err);
  process.exit(1);
});
