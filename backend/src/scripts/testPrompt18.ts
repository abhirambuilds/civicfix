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

async function runPrompt18Tests() {
  console.log('\n================================================================');
  console.log(' CivicFix - Prompt 18 Organization Issue Workflow Verification');
  console.log('================================================================\n');

  // Seeded User IDs
  const ORG_ADMIN_ID = 'f0000000-0000-0000-0000-000000000003'; // SRM Org Admin
  const MANAGER_ID = 'f0000000-0000-0000-0000-000000000004';   // Civil Dept Manager
  const STAFF_ID = 'f0000000-0000-0000-0000-000000000005';     // Electrical Field Staff
  const USER_1_ID = 'f0000000-0000-0000-0000-000000000006';    // Student/Citizen (Reporter of issue 1)

  // Seeded Department IDs
  const CIVIL_DEPT_ID = 'b0000000-0000-0000-0000-000000000001';
  const ELECTRICAL_DEPT_ID = 'b0000000-0000-0000-0000-000000000002';
  const UNRELATED_DEPT_ID = 'b0000000-0000-0000-0000-000000000099';

  // Seeded Issue IDs
  const TARGET_ISSUE_ID = 'a1000000-0000-0000-0000-000000000001'; // Electrical Issue

  // Generate tokens
  const orgAdminToken = generateToken({ id: ORG_ADMIN_ID, role: UserRole.ORG_ADMIN });
  const staffToken = generateToken({ id: STAFF_ID, role: UserRole.STAFF });
  const citizenToken = generateToken({ id: USER_1_ID, role: UserRole.USER });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 5000;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -------------------------------------------------------------
    // Test 1 & 2: Login as ORG_ADMIN & Retrieve Issue
    // -------------------------------------------------------------
    console.log('[Step 1 & 2] Authenticate ORG_ADMIN and retrieve target issue');
    const getIssueRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(getIssueRes.status === 200, 'ORG_ADMIN retrieves issue details (200 OK)');
    const initialIssue = ((await getIssueRes.json()) as any).data;
    assert(initialIssue.id === TARGET_ISSUE_ID, 'Target issue ID matches');

    // -------------------------------------------------------------
    // Test 3, 4, 5: Assign Department & Staff
    // -------------------------------------------------------------
    console.log('\n[Step 3, 4, 5] Assign department and staff technician');
    const assignRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({
        departmentId: ELECTRICAL_DEPT_ID,
        userId: STAFF_ID,
        notes: 'Assigned to Electrical department technician for urgent circuit inspection.',
      }),
    });
    assert(assignRes.status === 201 || assignRes.status === 200, 'Issue successfully assigned (200/201)');
    const assignData = ((await assignRes.json()) as any).data;
    assert(assignData.departmentId === ELECTRICAL_DEPT_ID, 'Department matches Electrical');
    assert(assignData.assignedUserId === STAFF_ID, 'Assigned user matches staff technician');
    assert(assignData.isActive === true, 'Assignment is active');

    // Verify assignment appears in list
    const asgnListRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/assignments`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(asgnListRes.status === 200, 'Assignments list fetched (200)');
    const asgnListData = ((await asgnListRes.json()) as any).data;
    assert(Array.isArray(asgnListData), 'Assignments returned as array');
    assert(asgnListData.some((a: any) => a.departmentId === ELECTRICAL_DEPT_ID && a.isActive), 'Active assignment verified in list');

    // -------------------------------------------------------------
    // Test 6 & 7: Reassign Staff/Department
    // -------------------------------------------------------------
    console.log('\n[Step 6 & 7] Reassign issue to Civil department & manager');
    const reassignRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({
        departmentId: CIVIL_DEPT_ID,
        userId: MANAGER_ID,
        notes: 'Reassigned to Civil Infrastructure team.',
      }),
    });
    assert(reassignRes.status === 201 || reassignRes.status === 200, 'Issue successfully reassigned (200/201)');

    // Verify reassignment is reflected and old assignment was deactivated
    const reasgnListRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/assignments`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    const reasgnListData = ((await reasgnListRes.json()) as any).data;
    const activeOne = reasgnListData.find((a: any) => a.isActive);
    assert(activeOne?.departmentId === CIVIL_DEPT_ID, 'Active assignment is now Civil department');
    const prevOne = reasgnListData.find((a: any) => a.departmentId === ELECTRICAL_DEPT_ID);
    assert(prevOne?.isActive === false, 'Previous Electrical assignment preserved with isActive=false');

    // -------------------------------------------------------------
    // Test 8 & 9: Change Status Through Valid Transition & Verify Timeline
    // -------------------------------------------------------------
    console.log('\n[Step 8 & 9] Valid status transition and status history audit');
    // First transition: IN_PROGRESS -> UNDER_REVIEW (re-evaluating work)
    const reviewRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({
        status: 'UNDER_REVIEW',
        remark: 'Reviewing scope of work before progressing.',
      }),
    });
    assert(reviewRes.status === 200, 'Valid transition to UNDER_REVIEW succeeds (200 OK)');

    // Second transition: UNDER_REVIEW -> IN_PROGRESS
    const statusRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        remark: 'Field crew has initiated repair work on site.',
      }),
    });
    const statusBody = (await statusRes.json()) as any;
    assert(statusRes.status === 200, 'Valid transition to IN_PROGRESS succeeds (200 OK)');
    const updatedStatusData = statusBody.data;
    assert(updatedStatusData?.status === 'IN_PROGRESS', 'Issue status is now IN_PROGRESS');

    // Verify timeline
    const histRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/status-history`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    assert(histRes.status === 200, 'Status history fetched (200 OK)');
    const histData = ((await histRes.json()) as any).data;
    assert(
      histData.some((h: any) => h.newStatus === 'IN_PROGRESS'),
      'Status history timeline records IN_PROGRESS transition'
    );
    assert(
      histData.some((h: any) => h.remark === 'Field crew has initiated repair work on site.'),
      'Authorized organization user can see status-history remarks'
    );

    const citizenHistRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/status-history`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    const citizenHistData = ((await citizenHistRes.json()) as any).data;
    assert(citizenHistRes.status === 200, 'Citizen can retrieve public status history');
    assert(
      citizenHistData.every((h: any) => !Object.prototype.hasOwnProperty.call(h, 'remark')),
      'Security: Citizen status history omits internal remarks'
    );

    // -------------------------------------------------------------
    // Test 10 & 11: Attempt Invalid Status Transition
    // -------------------------------------------------------------
    console.log('\n[Step 10 & 11] Invalid status transition rejection');
    // From IN_PROGRESS, valid transitions are only RESOLVED or UNDER_REVIEW. CLOSED is invalid.
    const invalidStatusRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({
        status: 'CLOSED', // Invalid directly from IN_PROGRESS
        remark: 'Premature close attempt',
      }),
    });
    assert(invalidStatusRes.status === 400, 'Backend rejects invalid transition from IN_PROGRESS to CLOSED (400 Bad Request)');

    // -------------------------------------------------------------
    // Test 12: Set Priority
    // -------------------------------------------------------------
    console.log('\n[Step 12] Priority management');
    const priorityRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/priority`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({
        priority: 'CRITICAL',
        remark: 'Escalated to CRITICAL due to potential safety hazard.',
      }),
    });
    assert(priorityRes.status === 200, 'ORG_ADMIN updates priority to CRITICAL (200 OK)');
    const priorityData = ((await priorityRes.json()) as any).data;
    assert(priorityData.priority === 'CRITICAL', 'Issue priority updated to CRITICAL');

    // -------------------------------------------------------------
    // Test 13, 14, 15: Internal Remarks vs Public Comments Isolation
    // -------------------------------------------------------------
    console.log('\n[Step 13, 14, 15] Internal operational remark security and isolation');
    const internalRemarkText = `CONFIDENTIAL_OP_NOTE_${Date.now()}: Breaker replacement scheduled.`;
    const addRemarkRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({
        commentText: internalRemarkText,
        isInternal: true,
      }),
    });
    assert(addRemarkRes.status === 201, 'Internal remark created successfully (201 Created)');

    // 14: ORG_ADMIN can see internal remark
    const orgCommentsRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/comments`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    const orgComments = ((await orgCommentsRes.json()) as any).data;
    assert(
      orgComments.some((c: any) => c.commentText === internalRemarkText && c.isInternal === true),
      'Security: ORG_ADMIN can see internal operational remarks'
    );

    // 15: Citizen USER CANNOT see internal remark
    const citizenCommentsRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/comments`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    const citizenComments = ((await citizenCommentsRes.json()) as any).data;
    assert(
      !citizenComments.some((c: any) => c.commentText === internalRemarkText),
      'Security CRITICAL: Internal remark is NOT exposed to citizen USER'
    );
    assert(
      citizenComments.every((c: any) => c.isInternal === false),
      'Security: Citizen comments list contains only public comments'
    );

    // -------------------------------------------------------------
    // Test 16 & 17: Resolve Issue with Resolution Information
    // -------------------------------------------------------------
    console.log('\n[Step 16 & 17] Resolve issue with resolution remark');
    const resolutionNotes = 'Defective circuit breaker replaced, thermal test passed.';
    const resolveRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({
        remark: resolutionNotes,
      }),
    });
    assert(resolveRes.status === 200, 'Issue marked as RESOLVED (200 OK)');
    const resolveData = ((await resolveRes.json()) as any).data;
    assert(resolveData.status === 'RESOLVED', 'Status changed to RESOLVED');
    assert(Boolean(resolveData.resolvedAt), 'Authoritative resolvedAt timestamp set by backend');

    // -------------------------------------------------------------
    // Test 18 & 19: Close Issue and Verify Final State
    // -------------------------------------------------------------
    console.log('\n[Step 18 & 19] Close issue by authorized official');
    const closeRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({
        status: 'CLOSED',
        remark: 'Work verified and closed by department administrator.',
      }),
    });
    assert(closeRes.status === 200, 'Issue transitioned from RESOLVED to CLOSED (200 OK)');
    const closeData = ((await closeRes.json()) as any).data;
    assert(closeData.status === 'CLOSED', 'Status is CLOSED');
    assert(Boolean(closeData.closedAt), 'Authoritative closedAt timestamp set by backend');

    // -------------------------------------------------------------
    // Test 20: User-Side Reflection
    // -------------------------------------------------------------
    console.log('\n[Step 20] Citizen user issue tracking reflection');
    const citizenIssueRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    assert(citizenIssueRes.status === 200, 'Citizen reporter can view their updated issue (200 OK)');
    const citizenIssueData = ((await citizenIssueRes.json()) as any).data;
    assert(citizenIssueData.status === 'CLOSED', 'Citizen sees updated status CLOSED');
    assert(Boolean(citizenIssueData.resolvedAt), 'Citizen sees resolvedAt timestamp');
    assert(Boolean(citizenIssueData.closedAt), 'Citizen sees closedAt timestamp');

    // -------------------------------------------------------------
    // Test 21: Organization Isolation (Cross-Org Assignment Rejection)
    // -------------------------------------------------------------
    console.log('\n[Step 21] Cross-organization isolation');
    const crossOrgAssignRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({
        departmentId: UNRELATED_DEPT_ID, // Department belonging to Unrelated Org
      }),
    });
    assert(
      crossOrgAssignRes.status === 400 || crossOrgAssignRes.status === 404 || crossOrgAssignRes.status === 403,
      'Security: Assignment to department from another organization rejected'
    );

    // -------------------------------------------------------------
    // Test 22: Role Restrictions (USER & STAFF boundaries)
    // -------------------------------------------------------------
    console.log('\n[Step 22] Role restrictions & RBAC boundaries');
    // USER cannot assign
    const userAssignRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({ departmentId: CIVIL_DEPT_ID }),
    });
    assert(userAssignRes.status === 403, 'RBAC: Citizen USER forbidden from assigning issues (403)');

    // USER cannot change status
    const userStatusRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    assert(userStatusRes.status === 403, 'RBAC: Citizen USER forbidden from changing status (403)');

    // USER cannot change priority
    const userPriorityRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/priority`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({ priority: 'LOW' }),
    });
    assert(userPriorityRes.status === 403, 'RBAC: Citizen USER forbidden from modifying priority (403)');

    // USER cannot resolve
    const userResolveRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({ remark: 'User self-resolve attempt' }),
    });
    assert(userResolveRes.status === 403, 'RBAC: Citizen USER forbidden from resolving issues (403)');

    // STAFF cannot close issues
    const staffCloseRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ status: 'CLOSED', remark: 'Staff close attempt' }),
    });
    assert(staffCloseRes.status === 403, 'RBAC: Field STAFF forbidden from closing issues (403)');

    // -------------------------------------------------------------
    // Test 23: Duplicate Submission Prevention
    // -------------------------------------------------------------
    console.log('\n[Step 23] Duplicate submission prevention');
    // Cannot transition to current status (already CLOSED)
    const duplicateStatusRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({ status: 'CLOSED' }),
    });
    assert(duplicateStatusRes.status === 400, 'Duplicate status transition rejected (400 Bad Request)');

    // Cannot resolve an already closed issue
    const duplicateResolveRes = await fetch(`${baseUrl}/api/issues/${TARGET_ISSUE_ID}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAdminToken}`,
      },
      body: JSON.stringify({ remark: 'Second resolve attempt' }),
    });
    assert(duplicateResolveRes.status === 400, 'Cannot resolve an already closed issue (400 Bad Request)');

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(` Prompt 18 Test Results: ${passed}/${total} PASSED (${failed} failed)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPrompt18Tests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
