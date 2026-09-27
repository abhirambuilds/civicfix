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

async function runIssueTests() {
  console.log('\n================================================================');
  console.log(' CivicFix - Core Civic Issue APIs Test Suite');
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

  // Seeded Categories
  const POTHOLE_CAT_ID = 'c0000000-0000-0000-0000-000000000001'; // Default: HIGH
  const STREETLIGHT_CAT_ID = 'c0000000-0000-0000-0000-000000000002'; // Default: MEDIUM

  // Seeded Existing Issues
  const STREETLIGHT_ISSUE_ID = 'a1000000-0000-0000-0000-000000000001'; // User 1's issue, Electrical Dept
  const POTHOLE_ISSUE_ID = 'a1000000-0000-0000-0000-000000000002';     // User 2's issue, Civil Dept

  // Tokens
  const platformAdminToken = generateToken({ id: PLATFORM_ADMIN_ID, role: UserRole.PLATFORM_ADMIN });
  const orgOwnerToken = generateToken({ id: ORG_OWNER_ID, role: UserRole.ORG_OWNER });
  const orgAdminToken = generateToken({ id: ORG_ADMIN_ID, role: UserRole.ORG_ADMIN });
  const managerToken = generateToken({ id: MANAGER_ID, role: UserRole.MANAGER });
  const staffToken = generateToken({ id: STAFF_ID, role: UserRole.STAFF });
  const user1Token = generateToken({ id: USER_1_ID, role: UserRole.USER });
  const user2Token = generateToken({ id: USER_2_ID, role: UserRole.USER });

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  let createdIssueId = '';

  try {
    // ============================================================================
    // SUITE 1: AUTHENTICATION & INPUT VALIDATION
    // ============================================================================
    console.log('[Suite 1] Authentication & Payload Validation');

    // 1.1 Unauthenticated request rejected -> 401
    const unauthRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Broken pipe near mess' }),
    });
    assert(unauthRes.status === 401, 'Unauthenticated POST /api/issues rejected (401 Unauthorized)');

    // 1.2 Title too short (< 5 chars) -> 400
    const shortTitleRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        title: 'Pipe',
        description: 'Water leaking heavily from main pipeline outside hostel',
        categoryId: POTHOLE_CAT_ID,
        latitude: 12.823,
        longitude: 80.045,
      }),
    });
    assert(shortTitleRes.status === 400, 'Validation: Title < 5 characters rejected (400 Bad Request)');

    // 1.3 Description too short (< 10 chars) -> 400
    const shortDescRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        title: 'Broken water tap',
        description: 'broken',
        categoryId: POTHOLE_CAT_ID,
        latitude: 12.823,
        longitude: 80.045,
      }),
    });
    assert(shortDescRes.status === 400, 'Validation: Description < 10 characters rejected (400 Bad Request)');

    // 1.4 Invalid latitude (> 90) -> 400
    const badLatRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        title: 'Broken water tap',
        description: 'Water leaking heavily from main pipeline outside hostel',
        categoryId: POTHOLE_CAT_ID,
        latitude: 120.5,
        longitude: 80.045,
      }),
    });
    assert(badLatRes.status === 400, 'Validation: Latitude > 90 rejected (400 Bad Request)');

    // 1.5 Invalid longitude (< -180) -> 400
    const badLonRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        title: 'Broken water tap',
        description: 'Water leaking heavily from main pipeline outside hostel',
        categoryId: POTHOLE_CAT_ID,
        latitude: 12.823,
        longitude: -200,
      }),
    });
    assert(badLonRes.status === 400, 'Validation: Longitude < -180 rejected (400 Bad Request)');

    // 1.6 Invalid category UUID -> 400
    const badCatRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        title: 'Broken water tap',
        description: 'Water leaking heavily from main pipeline outside hostel',
        categoryId: 'not-a-uuid',
        latitude: 12.823,
        longitude: 80.045,
      }),
    });
    assert(badCatRes.status === 400, 'Validation: Malformed categoryId rejected (400 Bad Request)');

    // 1.7 Non-existent category UUID -> 404
    const notFoundCatRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        title: 'Broken water tap',
        description: 'Water leaking heavily from main pipeline outside hostel',
        categoryId: 'c0000000-0000-0000-0000-000000000099',
        latitude: 12.823,
        longitude: 80.045,
      }),
    });
    assert(notFoundCatRes.status === 404, 'Category Check: Non-existent categoryId returns 404 Not Found');

    // 1.8 Strict schema: Field injection of server fields rejected -> 400
    const injectRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        title: 'Broken water tap',
        description: 'Water leaking heavily from main pipeline outside hostel',
        categoryId: POTHOLE_CAT_ID,
        latitude: 12.823,
        longitude: 80.045,
        userId: USER_2_ID,
        status: 'RESOLVED',
      }),
    });
    assert(injectRes.status === 400, 'Security: Injection of server fields (userId, status) rejected (400 Bad Request)');

    // ============================================================================
    // SUITE 2: ISSUE CREATION, INITIAL STATUS & LIFECYCLE FOUNDATION
    // ============================================================================
    console.log('\n[Suite 2] Issue Creation, Initial Status & Lifecycle');

    // 2.1 USER successfully reports a new civic issue -> 201 Created
    const createRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        title: 'Water pipe leak near Java Green Food Court',
        description: 'Continuous fresh water leakage from underground pipeline joints near the walkway.',
        categoryId: POTHOLE_CAT_ID,
        latitude: 12.8235,
        longitude: 80.0442,
        locationLabel: 'Near Java Green Food Court, SRM KTR',
      }),
    });
    const createJson = (await createRes.json()) as any;
    assert(createRes.status === 201, 'USER creates civic issue successfully (201 Created)');
    assert(createJson.data?.status === 'REPORTED', 'Initial status is strictly set to REPORTED');
    assert(Boolean(createJson.data?.issueNumber), 'Issue number generated automatically');
    assert(createJson.data?.reporter?.id === USER_1_ID, 'Authoritative reporter matches JWT identity');
    assert(Boolean(createJson.data?.location), 'Issue location record created atomically');
    assert(createJson.data?.location?.latitude === 12.8235, 'Location latitude matches input');
    assert(createJson.data?.location?.address === 'Near Java Green Food Court, SRM KTR', 'Location address matches locationLabel');
    assert(Array.isArray(createJson.data?.statusHistory), 'Initial status history record created');
    assert(createJson.data?.statusHistory[0]?.newStatus === 'REPORTED', 'Status history entry records newStatus REPORTED');
    createdIssueId = createJson.data?.id;

    // ============================================================================
    // SUITE 3: PRIORITY PROTECTION & SEVERITY ESCALATION GUARDS
    // ============================================================================
    console.log('\n[Suite 3] Priority Protection & Role Escalation Guards');

    // 3.1 Normal USER sends priority: CRITICAL -> Ignored or overridden by category default
    const userPriorityRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        title: 'Streetlight out near Dental College',
        description: 'Single streetlight is out on the access road.',
        categoryId: STREETLIGHT_CAT_ID, // default priority: MEDIUM
        latitude: 12.824,
        longitude: 80.045,
        priority: 'CRITICAL',
      }),
    });
    const userPriorityJson = (await userPriorityRes.json()) as any;
    assert(userPriorityRes.status === 201, 'Issue reported with client priority payload (201 Created)');
    assert(
      userPriorityJson.data?.priority !== 'CRITICAL' && userPriorityJson.data?.priority === 'MEDIUM',
      'Security: Normal USER cannot escalate priority to CRITICAL (defaults to category MEDIUM)'
    );

    // 3.2 ORG_ADMIN can set priority -> 201 Created with specified priority
    const adminPriorityRes = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: authHeader(orgAdminToken),
      body: JSON.stringify({
        title: 'Urgent Electrical Hazard at Substation 2',
        description: 'Exposed live wiring sparking near transformer enclosure.',
        categoryId: STREETLIGHT_CAT_ID,
        latitude: 12.825,
        longitude: 80.046,
        priority: 'CRITICAL',
      }),
    });
    const adminPriorityJson = (await adminPriorityRes.json()) as any;
    assert(adminPriorityRes.status === 201, 'ORG_ADMIN creates issue with priority (201 Created)');
    assert(adminPriorityJson.data?.priority === 'CRITICAL', 'Authorized ORG_ADMIN priority respected');

    // ============================================================================
    // SUITE 4: SINGLE ISSUE RETRIEVAL & IDOR GUARDS
    // ============================================================================
    console.log('\n[Suite 4] Single Issue Retrieval & IDOR Protection');

    // 4.1 Malformed issueId -> 400
    const malformedIssueRes = await fetch(`${baseUrl}/api/issues/not-a-uuid`, {
      headers: authHeader(user1Token),
    });
    assert(malformedIssueRes.status === 400, 'Malformed issueId parameter rejected (400 Bad Request)');

    // 4.2 Non-existent issueId -> 404
    const notFoundIssueRes = await fetch(`${baseUrl}/api/issues/a1000000-0000-0000-0000-000000000099`, {
      headers: authHeader(user1Token),
    });
    assert(notFoundIssueRes.status === 404, 'Non-existent issueId returns 404 Not Found');

    // 4.3 USER 1 retrieves own issue -> 200 OK
    const getOwnRes = await fetch(`${baseUrl}/api/issues/${createdIssueId}`, {
      headers: authHeader(user1Token),
    });
    const getOwnJson = (await getOwnRes.json()) as any;
    assert(getOwnRes.status === 200, 'USER retrieves own issue successfully (200 OK)');
    assert(getOwnJson.data?.id === createdIssueId, 'Retrieved issue ID matches');
    assert(!getOwnJson.data?.reporter?.passwordHash, 'Security: Password hash not exposed in reporter object');

    // 4.4 IDOR Attack: USER 2 attempts to retrieve USER 1's issue -> 403 Forbidden
    const idorRes = await fetch(`${baseUrl}/api/issues/${createdIssueId}`, {
      headers: authHeader(user2Token),
    });
    assert(idorRes.status === 403, 'IDOR Guard: USER 2 denied from accessing USER 1 issue (403 Forbidden)');

    // 4.5 IDOR Attack: Manipulating issueId from Issue A to Issue B rejected
    const idor2Res = await fetch(`${baseUrl}/api/issues/${POTHOLE_ISSUE_ID}`, {
      headers: authHeader(user1Token), // Pothole is reported by User 2
    });
    assert(idor2Res.status === 403, 'IDOR Guard: Changing issueId parameter does not expose unauthorized issue (403)');

    // 4.6 ORG_ADMIN retrieves issue belonging to own organization -> 200 OK
    const adminGetRes = await fetch(`${baseUrl}/api/issues/${createdIssueId}`, {
      headers: authHeader(orgAdminToken),
    });
    assert(adminGetRes.status === 200, 'ORG_ADMIN retrieves issue in own organization (200 OK)');

    // 4.7 PLATFORM_ADMIN retrieves issue across platform -> 200 OK
    const platformGetRes = await fetch(`${baseUrl}/api/issues/${createdIssueId}`, {
      headers: authHeader(platformAdminToken),
    });
    assert(platformGetRes.status === 200, 'PLATFORM_ADMIN retrieves issue platform-wide (200 OK)');

    // ============================================================================
    // SUITE 5: ISSUE LISTING & ROLE-BASED SCOPING
    // ============================================================================
    console.log('\n[Suite 5] Issue Listing & Scoped Filtering');

    // 5.1 USER lists issues -> strictly returns only their own reported issues
    const userListRes = await fetch(`${baseUrl}/api/issues`, {
      headers: authHeader(user1Token),
    });
    const userListJson = (await userListRes.json()) as any;
    assert(userListRes.status === 200, 'USER lists issues successfully (200 OK)');
    assert(Array.isArray(userListJson.data?.issues), 'Issues returned as array');
    const allBelongToUser1 = userListJson.data?.issues.every(
      (i: any) => i.reporterId === USER_1_ID
    );
    assert(allBelongToUser1, 'Ownership Guard: USER issue list strictly contains only their own issues');

    // 5.2 Ownership Bypass Attempt: USER provides ?organizationId=... filter
    // Must NOT return other users' issues from that organization!
    const bypassOrgRes = await fetch(`${baseUrl}/api/issues?organizationId=${SRM_ORG_ID}`, {
      headers: authHeader(user1Token),
    });
    const bypassOrgJson = (await bypassOrgRes.json()) as any;
    const bypassPrevented = bypassOrgJson.data?.issues.every(
      (i: any) => i.reporterId === USER_1_ID
    );
    assert(bypassPrevented, 'Ownership Guard: organizationId query param cannot bypass USER reporter scoping');

    // 5.3 ORG_ADMIN lists issues in own organization -> 200 OK
    const adminListRes = await fetch(`${baseUrl}/api/issues?organizationId=${SRM_ORG_ID}`, {
      headers: authHeader(orgAdminToken),
    });
    const adminListJson = (await adminListRes.json()) as any;
    assert(adminListRes.status === 200, 'ORG_ADMIN lists issues in own organization (200 OK)');
    assert(adminListJson.data?.issues?.length >= 2, 'ORG_ADMIN sees organization issues across reporters');

    // 5.4 Cross-Tenant Guard: ORG_ADMIN attempts to list another org's issues -> 403
    const crossOrgListRes = await fetch(`${baseUrl}/api/issues?organizationId=${UNRELATED_ORG_ID}`, {
      headers: authHeader(orgAdminToken),
    });
    assert(crossOrgListRes.status === 403, 'Tenant Isolation: ORG_ADMIN denied from listing unrelated org issues (403)');

    // 5.5 ORG_OWNER lists issues in own organization -> 200 OK
    const ownerListRes = await fetch(`${baseUrl}/api/issues`, {
      headers: authHeader(orgOwnerToken),
    });
    assert(ownerListRes.status === 200, 'ORG_OWNER lists organization issues (200 OK)');

    // 5.6 PLATFORM_ADMIN lists issues without tenant restrictions -> 200 OK
    const platformListRes = await fetch(`${baseUrl}/api/issues`, {
      headers: authHeader(platformAdminToken),
    });
    assert(platformListRes.status === 200, 'PLATFORM_ADMIN lists issues platform-wide (200 OK)');

    // 5.7 Filter by status: ?status=REPORTED
    const statusFilterRes = await fetch(`${baseUrl}/api/issues?status=REPORTED`, {
      headers: authHeader(orgAdminToken),
    });
    const statusFilterJson = (await statusFilterRes.json()) as any;
    const allReported = statusFilterJson.data?.issues.every((i: any) => i.status === 'REPORTED');
    assert(allReported, 'Status Filter: All returned issues have status REPORTED');

    // 5.8 Search filter: ?search=water
    const searchRes = await fetch(`${baseUrl}/api/issues?search=water`, {
      headers: authHeader(orgAdminToken),
    });
    const searchJson = (await searchRes.json()) as any;
    assert(searchRes.status === 200, 'Search by keyword returns 200 OK');
    assert(searchJson.data?.issues?.length >= 1, 'Search finds issues matching "water"');

    // ============================================================================
    // SUITE 6: MANAGER & STAFF DEPARTMENT ISOLATION
    // ============================================================================
    console.log('\n[Suite 6] Manager & Staff Department Isolation');

    // 6.1 MANAGER accesses assigned department issue (Civil Dept) -> 200 OK
    const managerGetCivilRes = await fetch(`${baseUrl}/api/issues/${POTHOLE_ISSUE_ID}`, {
      headers: authHeader(managerToken),
    });
    assert(managerGetCivilRes.status === 200, 'MANAGER accesses assigned Civil department issue (200 OK)');

    // 6.2 Dept Isolation: MANAGER attempts to access Electrical department issue -> 403
    const managerGetElecRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}`, {
      headers: authHeader(managerToken),
    });
    assert(managerGetElecRes.status === 403, 'Dept Isolation: MANAGER denied from Electrical department issue (403)');

    // 6.3 STAFF accesses assigned department issue (Electrical Dept) -> 200 OK
    const staffGetElecRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}`, {
      headers: authHeader(staffToken),
    });
    assert(staffGetElecRes.status === 200, 'STAFF accesses assigned Electrical department issue (200 OK)');

    // 6.4 Dept Isolation: STAFF attempts to access Civil department issue -> 403
    const staffGetCivilRes = await fetch(`${baseUrl}/api/issues/${POTHOLE_ISSUE_ID}`, {
      headers: authHeader(staffToken),
    });
    assert(staffGetCivilRes.status === 403, 'Dept Isolation: STAFF denied from Civil department issue (403)');

    // ============================================================================
    // SUITE 7: PAGINATION & SAFE LIMITS
    // ============================================================================
    console.log('\n[Suite 7] Pagination & Safe Limits');

    // 7.1 Default pagination returns page, limit, total, totalPages
    const pageRes = await fetch(`${baseUrl}/api/issues?page=1&limit=5`, {
      headers: authHeader(orgAdminToken),
    });
    const pageJson = (await pageRes.json()) as any;
    assert(pageRes.status === 200, 'Pagination query returns 200 OK');
    assert(pageJson.data?.pagination?.page === 1, 'Pagination page = 1');
    assert(pageJson.data?.pagination?.limit === 5, 'Pagination limit = 5');
    assert(typeof pageJson.data?.pagination?.total === 'number', 'Pagination total is number');
    assert(typeof pageJson.data?.pagination?.totalPages === 'number', 'Pagination totalPages is number');

    // 7.2 Excessive limit (> 100) rejected -> 400
    const hugeLimitRes = await fetch(`${baseUrl}/api/issues?limit=1000000`, {
      headers: authHeader(orgAdminToken),
    });
    assert(hugeLimitRes.status === 400, 'Security: Huge limit (> 100) rejected (400 Bad Request)');

    // ============================================================================
    // SUITE 8: ISSUE COMMENTS & INTERNAL REMARKS
    // ============================================================================
    console.log('\n[Suite 8] Issue Comments & Internal Remarks');

    // 8.1 USER comments on own issue -> 201 Created
    const userCommentRes = await fetch(`${baseUrl}/api/issues/${createdIssueId}/comments`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        content: 'The leak has intensified since this morning.',
      }),
    });
    const userCommentJson = (await userCommentRes.json()) as any;
    assert(userCommentRes.status === 201, 'USER adds comment to own issue (201 Created)');
    assert(userCommentJson.data?.author?.id === USER_1_ID, 'Author ID automatically derived from JWT');
    assert(userCommentJson.data?.isInternal === false, 'User comment is public (isInternal = false)');

    // 8.2 IDOR Guard: USER 2 cannot comment on USER 1's issue -> 403
    const idorCommentRes = await fetch(`${baseUrl}/api/issues/${createdIssueId}/comments`, {
      method: 'POST',
      headers: authHeader(user2Token),
      body: JSON.stringify({
        content: 'Malicious unauthorized comment',
      }),
    });
    assert(idorCommentRes.status === 403, 'IDOR Guard: Unauthorized user cannot comment on inaccessible issue (403)');

    // 8.3 Security: USER attempts to submit internal comment (isInternal: true)
    // Server must force isInternal: false for normal users
    const spoofInternalRes = await fetch(`${baseUrl}/api/issues/${createdIssueId}/comments`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: JSON.stringify({
        content: 'User trying to create internal staff note',
        isInternal: true,
      }),
    });
    const spoofInternalJson = (await spoofInternalRes.json()) as any;
    assert(spoofInternalRes.status === 201, 'Comment processed');
    assert(spoofInternalJson.data?.isInternal === false, 'Privilege Guard: Normal USER cannot create internal comments');

    // 8.4 STAFF adds internal comment -> 201 with isInternal = true
    const staffInternalCommentRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/comments`, {
      method: 'POST',
      headers: authHeader(staffToken),
      body: JSON.stringify({
        content: 'Internal technician note: capacitor replacement needed.',
        isInternal: true,
      }),
    });
    const staffInternalJson = (await staffInternalCommentRes.json()) as any;
    assert(staffInternalCommentRes.status === 201, 'STAFF adds internal comment (201 Created)');
    assert(staffInternalJson.data?.isInternal === true, 'Staff internal comment saved with isInternal = true');

    // 8.5 USER views comments -> internal comments are hidden
    const userGetCommentsRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/comments`, {
      headers: authHeader(user1Token), // User 1 is reporter of STREETLIGHT_ISSUE_ID
    });
    const userGetCommentsJson = (await userGetCommentsRes.json()) as any;
    assert(userGetCommentsRes.status === 200, 'USER views issue comments (200 OK)');
    const hasInternalComments = userGetCommentsJson.data?.some((c: any) => c.isInternal === true);
    assert(!hasInternalComments, 'Privacy Guard: Internal staff comments hidden from normal USER');

    // 8.6 STAFF views comments -> internal comments are visible
    const staffGetCommentsRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/comments`, {
      headers: authHeader(staffToken),
    });
    const staffGetCommentsJson = (await staffGetCommentsRes.json()) as any;
    assert(staffGetCommentsRes.status === 200, 'STAFF views issue comments (200 OK)');
    const staffSeesInternal = staffGetCommentsJson.data?.some((c: any) => c.isInternal === true);
    assert(staffSeesInternal, 'STAFF can view internal remarks');

    // ============================================================================
    // SUITE 9: ACTIVE ISSUE CATEGORIES ENDPOINT
    // ============================================================================
    console.log('\n[Suite 9] Issue Categories Endpoint');

    // 9.1 GET /api/issue-categories returns active categories
    const categoriesRes = await fetch(`${baseUrl}/api/issue-categories`, {
      headers: authHeader(user1Token),
    });
    const categoriesJson = (await categoriesRes.json()) as any;
    assert(categoriesRes.status === 200, 'GET /api/issue-categories returns 200 OK');
    assert(Array.isArray(categoriesJson.data), 'Categories returned as array');
    assert(categoriesJson.data?.length >= 5, 'Returns all seeded active categories');
    assert(Boolean(categoriesJson.data[0]?.name), 'Category contains name');
    assert(Boolean(categoriesJson.data[0]?.slug), 'Category contains slug');
    assert(!categoriesJson.data[0]?.routingRules, 'Security: Routing rules not exposed');

    // ============================================================================
    // SUITE 10: PRESERVATION OF PROMPTS 1-8 ENDPOINTS
    // ============================================================================
    console.log('\n[Suite 10] Preservation of Prompts 1-8 Endpoints');

    // 10.1 GET /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert(healthRes.status === 200, 'GET /api/health continues to return 200 OK');

    // 10.2 GET /api/auth/me
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: authHeader(user1Token),
    });
    assert(meRes.status === 200, 'GET /api/auth/me continues to return 200 OK');

    // 10.3 GET /api/organizations
    const orgsRes = await fetch(`${baseUrl}/api/organizations`, {
      headers: authHeader(platformAdminToken),
    });
    assert(orgsRes.status === 200, 'GET /api/organizations continues to return 200 OK');

    // 10.4 GET /api/organizations/:id/departments
    const deptsRes = await fetch(`${baseUrl}/api/organizations/${SRM_ORG_ID}/departments`, {
      headers: authHeader(orgAdminToken),
    });
    assert(deptsRes.status === 200, 'GET /api/organizations/:id/departments continues to return 200 OK');

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n================================================================');
  console.log(` Issue API Test Results: ${passed}/${results.length} PASSED`);
  if (failed > 0) {
    console.error(` ${failed} TESTS FAILED!`);
    process.exit(1);
  } else {
    console.log(' ALL 45+ CORE CIVIC ISSUE API & SECURITY TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  }
}

runIssueTests().catch((err) => {
  console.error('Fatal error during issue tests:', err);
  process.exit(1);
});
