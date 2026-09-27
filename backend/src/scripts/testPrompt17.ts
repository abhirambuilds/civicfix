import http from 'http';
import { app } from '../index.js';
import { generateToken } from '../services/auth.service.js';
import { UserRole } from '@prisma/client';

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

async function runPrompt17Tests() {
  console.log('\n================================================================');
  console.log(' CivicFix - Prompt 17 Organization Issue Management Verification');
  console.log('================================================================\n');

  // Seeded User IDs
  const PLATFORM_ADMIN_ID = 'f0000000-0000-0000-0000-000000000001';
  const ORG_OWNER_ID = 'f0000000-0000-0000-0000-000000000002';
  const ORG_ADMIN_ID = 'f0000000-0000-0000-0000-000000000003';
  const MANAGER_ID = 'f0000000-0000-0000-0000-000000000004'; // Civil Dept Manager
  const STAFF_ID = 'f0000000-0000-0000-0000-000000000005';   // Electrical Dept Staff
  const USER_1_ID = 'f0000000-0000-0000-0000-000000000006';  // Student/Citizen
  const USER_2_ID = 'f0000000-0000-0000-0000-000000000007';  // Other Citizen

  // Seeded Organization IDs
  const SRM_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
  const UNRELATED_ORG_ID = 'a0000000-0000-0000-0000-000000000099';

  // Seeded Issue IDs
  const ELECTRICAL_ISSUE_ID = 'a1000000-0000-0000-0000-000000000001';
  const CIVIL_ISSUE_ID = 'a1000000-0000-0000-0000-000000000002';

  // Generate tokens
  const platformAdminToken = generateToken({ id: PLATFORM_ADMIN_ID, email: 'platform.admin@civicfix.demo', role: UserRole.PLATFORM_ADMIN });
  const orgOwnerToken = generateToken({ id: ORG_OWNER_ID, email: 'srm.owner@civicfix.demo', role: UserRole.ORG_OWNER });
  const orgAdminToken = generateToken({ id: ORG_ADMIN_ID, email: 'srm.admin@civicfix.demo', role: UserRole.ORG_ADMIN });
  const managerToken = generateToken({ id: MANAGER_ID, email: 'manager@civicfix.demo', role: UserRole.MANAGER });
  const staffToken = generateToken({ id: STAFF_ID, email: 'staff@civicfix.demo', role: UserRole.STAFF });
  const user1Token = generateToken({ id: USER_1_ID, email: 'student@civicfix.demo', role: UserRole.USER });
  const user2Token = generateToken({ id: USER_2_ID, email: 'user2@civicfix.demo', role: UserRole.USER });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 5000;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -------------------------------------------------------------
    // Test Group 1: Organization Departments Endpoint (/me/departments)
    // -------------------------------------------------------------
    console.log('[Test Group 1] Organization Departments Context Endpoint');

    // 1.1 Unauthenticated
    const unauthDeptRes = await fetch(`${baseUrl}/api/organizations/me/departments`);
    assert(unauthDeptRes.status === 401, 'Unauthenticated GET /api/organizations/me/departments rejected (401)');

    // 1.2 USER role is forbidden
    const userDeptRes = await fetch(`${baseUrl}/api/organizations/me/departments`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert(userDeptRes.status === 403, 'Citizen USER forbidden from GET /api/organizations/me/departments (403)');

    // 1.3 ORG_ADMIN accesses departments
    const orgAdminDeptRes = await fetch(`${baseUrl}/api/organizations/me/departments`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(orgAdminDeptRes.status === 200, 'ORG_ADMIN retrieves organization departments (200)');
    const orgAdminDeptData = await orgAdminDeptRes.json();
    assert(Array.isArray(orgAdminDeptData.data.departments), 'Departments returned as array');
    assert(orgAdminDeptData.data.departments.length > 0, 'Departments contains active seeded departments');

    // 1.4 MANAGER and STAFF can access their organization departments
    const managerDeptRes = await fetch(`${baseUrl}/api/organizations/me/departments`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(managerDeptRes.status === 200, 'MANAGER retrieves organization departments (200)');

    const staffDeptRes = await fetch(`${baseUrl}/api/organizations/me/departments`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffDeptRes.status === 200, 'STAFF retrieves organization departments (200)');

    // -------------------------------------------------------------
    // Test Group 2: Organization Issue List (/api/issues)
    // -------------------------------------------------------------
    console.log('\n[Test Group 2] Organization Issue Listing & Search/Filters');

    // 2.1 ORG_ADMIN lists issues
    const listRes = await fetch(`${baseUrl}/api/issues`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(listRes.status === 200, 'ORG_ADMIN lists organization issues (200)');
    const listData = await listRes.json();
    assert(Array.isArray(listData.data.issues), 'Issues returned as array');
    assert(listData.data.issues.length > 0, 'Issues list contains real records');
    assert(Boolean(listData.data.pagination), 'Pagination metadata included');

    // 2.2 IDOR check: Attempting to query an unrelated organization
    const idorListRes = await fetch(`${baseUrl}/api/issues?organizationId=${UNRELATED_ORG_ID}`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(idorListRes.status === 403, 'Cross-org IDOR attempt rejected with 403 Forbidden');

    // 2.3 Search by issue number
    const targetIssue = listData.data.issues[0];
    const searchNumberRes = await fetch(`${baseUrl}/api/issues?search=${targetIssue.issueNumber}`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(searchNumberRes.status === 200, 'Search by issue number returns 200 OK');
    const searchNumberData = await searchNumberRes.json();
    assert(
      searchNumberData.data.issues.some((i: any) => i.issueNumber === targetIssue.issueNumber),
      'Search by issue number matches exact issue'
    );

    // 2.4 Filter by status
    const statusRes = await fetch(`${baseUrl}/api/issues?status=REPORTED`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(statusRes.status === 200, 'Filter by status returns 200 OK');
    const statusData = await statusRes.json();
    assert(
      statusData.data.issues.every((i: any) => i.status === 'REPORTED'),
      'All returned issues match requested status REPORTED'
    );

    // 2.5 Filter by priority
    const priorityRes = await fetch(`${baseUrl}/api/issues?priority=CRITICAL`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(priorityRes.status === 200, 'Filter by priority returns 200 OK');
    const priorityData = await priorityRes.json();
    assert(
      priorityData.data.issues.every((i: any) => i.priority === 'CRITICAL'),
      'All returned issues match requested priority CRITICAL'
    );

    // 2.6 Pagination
    const pageRes = await fetch(`${baseUrl}/api/issues?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(pageRes.status === 200, 'Pagination page=1&limit=2 returns 200 OK');
    const pageData = await pageRes.json();
    assert(pageData.data.issues.length <= 2, 'Issues array constrained to requested limit (2)');
    assert(pageData.data.pagination.page === 1, 'Pagination page correctly reported as 1');
    assert(pageData.data.pagination.limit === 2, 'Pagination limit correctly reported as 2');

    // -------------------------------------------------------------
    // Test Group 3: Issue Details & Reporter Information Privacy
    // -------------------------------------------------------------
    console.log('\n[Test Group 3] Issue Details & Reporter Information Privacy');

    // 3.1 ORG_ADMIN opens single issue
    const issueDetailRes = await fetch(`${baseUrl}/api/issues/${ELECTRICAL_ISSUE_ID}`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(issueDetailRes.status === 200, 'ORG_ADMIN retrieves issue details (200)');
    const issueDetail = await issueDetailRes.json();
    assert(issueDetail.data.id === ELECTRICAL_ISSUE_ID, 'Retrieved correct issue ID');
    assert(Boolean(issueDetail.data.reporter), 'Reporter object present');
    assert(Boolean(issueDetail.data.reporter.name), 'Reporter name present');
    assert(Boolean(issueDetail.data.reporter.email), 'Reporter email present');

    // PRIVACY AUDIT: Ensure sensitive credentials are NOT leaked
    assert(!('password' in issueDetail.data.reporter), 'Security: Password hash not exposed in reporter');
    assert(!('passwordHash' in issueDetail.data.reporter), 'Security: passwordHash not exposed in reporter');
    assert(!('token' in issueDetail.data.reporter), 'Security: Token not exposed in reporter');

    // 3.2 Citizen USER cannot view an issue they did not report
    const citizenIdorRes = await fetch(`${baseUrl}/api/issues/${ELECTRICAL_ISSUE_ID}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    assert(citizenIdorRes.status === 403, 'Citizen USER denied access to another citizen issue (403)');

    // -------------------------------------------------------------
    // Test Group 4: Comments & Internal Remarks Visibility
    // -------------------------------------------------------------
    console.log('\n[Test Group 4] Comments & Internal Remarks Scoping');

    const orgCommentsRes = await fetch(`${baseUrl}/api/issues/${ELECTRICAL_ISSUE_ID}/comments`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(orgCommentsRes.status === 200, 'ORG_ADMIN fetches comments and remarks (200)');
    const orgCommentsData = await orgCommentsRes.json();
    assert(Array.isArray(orgCommentsData.data), 'Comments returned as array');

    // -------------------------------------------------------------
    // Test Group 5: Status History Audit
    // -------------------------------------------------------------
    console.log('\n[Test Group 5] Status History Audit Trail');

    const historyRes = await fetch(`${baseUrl}/api/issues/${ELECTRICAL_ISSUE_ID}/status-history`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(historyRes.status === 200, 'ORG_ADMIN fetches status history (200)');
    const historyData = await historyRes.json();
    assert(Array.isArray(historyData.data), 'Status history returned as array');

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(` Prompt 17 Test Results: ${passed}/${total} PASSED (${failed} failed)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPrompt17Tests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
