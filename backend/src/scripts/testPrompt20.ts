import http from 'http';
import { app } from '../index.js';
import { generateToken } from '../services/auth.service.js';
import { UserRole } from '@prisma/client';

interface TestResult { name: string; passed: boolean; }
const results: TestResult[] = [];

function assert(condition: boolean, name: string): void {
  results.push({ name, passed: condition });
  console.log(`  ${condition ? '✓' : '✗'} ${name}`);
}

async function run(): Promise<void> {
  console.log('\n================================================================');
  console.log(' CivicFix - Prompt 20 Organization Analytics Tests');
  console.log('================================================================\n');

  const tokens = {
    owner: generateToken({ id: 'f0000000-0000-0000-0000-000000000002', role: UserRole.ORG_OWNER }),
    admin: generateToken({ id: 'f0000000-0000-0000-0000-000000000003', role: UserRole.ORG_ADMIN }),
    manager: generateToken({ id: 'f0000000-0000-0000-0000-000000000004', role: UserRole.MANAGER }),
    staff: generateToken({ id: 'f0000000-0000-0000-0000-000000000005', role: UserRole.STAFF }),
    user: generateToken({ id: 'f0000000-0000-0000-0000-000000000006', role: UserRole.USER }),
  };

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  const url = `http://localhost:${port}/api/organizations/me/analytics`;
  const get = (token: string, query = '') => fetch(`${url}${query}`, { headers: { Authorization: `Bearer ${token}` } });

  try {
    const adminResponse = await get(tokens.admin, '?timeRange=all');
    const adminBody = (await adminResponse.json()) as any;
    const data = adminBody.data;
    assert(adminResponse.status === 200, 'ORG_ADMIN can retrieve organization analytics');
    assert(data?.organization?.id === 'a0000000-0000-0000-0000-000000000001', 'Analytics organization is derived from authenticated membership');
    assert(data?.summary && Array.isArray(data.byStatus) && Array.isArray(data.byCategory), 'Analytics response contains summary and distributions');
    assert(data.summary.totalIssues === data.byStatus.reduce((sum: number, item: any) => sum + item.value, 0), 'Summary total matches status distribution');
    assert(data.filters.timezone === 'UTC', 'Analytics declares the UTC date strategy');

    const ownerResponse = await get(tokens.owner, '?timeRange=all');
    assert(ownerResponse.status === 200, 'ORG_OWNER can retrieve organization analytics');

    const managerResponse = await get(tokens.manager, '?timeRange=all');
    assert(managerResponse.status === 200, 'MANAGER can retrieve department-scoped analytics');

    const staffResponse = await get(tokens.staff, '?timeRange=all');
    assert(staffResponse.status === 200, 'STAFF can retrieve department-scoped analytics');

    const userResponse = await get(tokens.user, '?timeRange=all');
    assert(userResponse.status === 403, 'USER cannot retrieve organization analytics');

    const tamperResponse = await get(tokens.admin, '?timeRange=all&organizationId=a0000000-0000-0000-0000-000000000099');
    assert(tamperResponse.status === 400, 'organizationId query tampering is rejected');

    const crossDeptResponse = await get(tokens.manager, '?timeRange=all&departmentId=b0000000-0000-0000-0000-000000000002');
    assert(crossDeptResponse.status === 403, 'MANAGER cannot select another department scope');

    const invalidCategoryResponse = await get(tokens.admin, '?timeRange=all&categoryId=c0000000-0000-0000-0000-000000000099');
    assert(invalidCategoryResponse.status === 404, 'Invalid or cross-organization category filter is rejected');
  } finally {
    server.close();
  }

  const passed = results.filter((result) => result.passed).length;
  console.log(`\nPrompt 20 Analytics Test Results: ${passed}/${results.length} PASSED\n`);
  if (passed !== results.length) process.exit(1);
}

run().catch((error) => {
  console.error('Prompt 20 test execution failed:', error);
  process.exit(1);
});
