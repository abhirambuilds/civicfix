import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { app } from '../index.js';
import { generateToken } from '../services/auth.service.js';
import { createIssue } from '../services/issue.service.js';
import {
  issueIntelligenceSchema,
  resetIssueIntelligenceStore,
  runIssueIntelligenceAnalysis,
  setIssueIntelligenceProviderForTests,
} from '../services/issue-intelligence.service.js';
import { UserRole } from '@prisma/client';

const USER_1_ID = 'f0000000-0000-0000-0000-000000000006';
const USER_2_ID = 'f0000000-0000-0000-0000-000000000007';
const ORG_OWNER_ID = 'f0000000-0000-0000-0000-000000000002';
const CATEGORY_ID = 'c0000000-0000-0000-0000-000000000001';
const SEEDED_ISSUE_ID = 'a1000000-0000-0000-0000-000000000001';

const context = (issueId: string) => ({
  issueId,
  title: 'Broken streetlight near the library',
  description: 'The light has been off for three nights and the walkway is very dark.',
  category: 'Streetlight',
  address: 'North campus library',
  landmark: 'Library entrance',
});

const validResult = {
  normalizedTitle: 'Broken streetlight near the library',
  summary: 'A non-functional streetlight is leaving a busy walkway dark at night.',
  severity: 'HIGH',
  urgency: 'HIGH',
  impact: 'HIGH',
  issueType: 'Streetlight outage',
  keywords: ['streetlight', 'dark walkway', 'library'],
  suggestedPriority: 'HIGH',
  recommendedAction: 'Inspect the fixture and restore lighting after dusk.',
  confidence: 0.94,
  descriptionSufficient: true,
  clarificationQuestion: null,
};

async function main(): Promise<void> {
  let passed = 0;
  const check = (condition: boolean, message: string) => {
    assert.equal(condition, true, message);
    passed += 1;
    console.log(`  ✓ ${message}`);
  };

  console.log('\nCivicFix Issue Intelligence Agent Tests');
  resetIssueIntelligenceStore();

  setIssueIntelligenceProviderForTests(async () => ({ choices: [{ message: { content: JSON.stringify(validResult) } }] }));
  const completed = await runIssueIntelligenceAnalysis(context('a1000000-0000-0000-0000-000000000101'));
  check(completed.status === 'COMPLETED', 'valid structured provider response completes');
  check(completed.structuredResult?.severity === 'HIGH', 'valid severity is persisted');
  check(completed.structuredResult?.suggestedPriority === 'HIGH', 'valid suggested priority is persisted');

  setIssueIntelligenceProviderForTests(async () => ({ severity: 'NOT_A_LEVEL' }));
  const malformed = await runIssueIntelligenceAnalysis(context('a1000000-0000-0000-0000-000000000102'));
  check(malformed.status === 'FAILED', 'malformed provider output is rejected');
  check(!malformed.structuredResult, 'malformed output is not exposed as a result');
  check(!issueIntelligenceSchema.safeParse({ ...validResult, severity: 'INVALID' }).success, 'invalid severity is rejected by schema');
  check(!issueIntelligenceSchema.safeParse({ ...validResult, suggestedPriority: 'INVALID' }).success, 'invalid priority is rejected by schema');

  setIssueIntelligenceProviderForTests(null);
  const missingKey = await runIssueIntelligenceAnalysis(context('a1000000-0000-0000-0000-000000000103'));
  check(missingKey.status === 'FAILED', 'missing Groq key returns a failed/unavailable state');

  setIssueIntelligenceProviderForTests(async () => { throw new Error('provider secret should not escape'); });
  const providerFailure = await runIssueIntelligenceAnalysis(context('a1000000-0000-0000-0000-000000000104'));
  check(providerFailure.status === 'FAILED', 'provider failure is converted to a failed state');

  setIssueIntelligenceProviderForTests((_prompt, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('timed out', 'AbortError')));
  }));
  const timedOut = await runIssueIntelligenceAnalysis(context('a1000000-0000-0000-0000-000000000105'));
  check(timedOut.status === 'FAILED', 'provider timeout is converted to a failed state');

  setIssueIntelligenceProviderForTests(async () => { throw new Error('simulated failure'); });
  const created = await createIssue(USER_1_ID, UserRole.USER, {
    title: 'AI failure must not block issue creation',
    description: 'This report should still be created when the AI provider is unavailable.',
    categoryId: CATEGORY_ID,
    latitude: 12.823,
    longitude: 80.045,
  });
  check(created.success && created.statusCode === 201, 'issue creation succeeds when AI analysis fails');

  setIssueIntelligenceProviderForTests(async () => validResult);
  await runIssueIntelligenceAnalysis(context(SEEDED_ISSUE_ID));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  const endpoint = `http://localhost:${port}/api/issues/${SEEDED_ISSUE_ID}/ai-analysis`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const user2Token = generateToken({ id: USER_2_ID, role: UserRole.USER });
  const ownerToken = generateToken({ id: ORG_OWNER_ID, role: UserRole.ORG_OWNER });
  const user1Token = generateToken({ id: USER_1_ID, role: UserRole.USER });

  try {
    const unauthorized = await fetch(endpoint, { headers: auth(user2Token) });
    check(unauthorized.status === 403, 'normal USER cannot access another user\'s AI analysis');

    const citizen = await fetch(endpoint, { headers: auth(user1Token) });
    check(citizen.status === 403, 'normal USER cannot access organization-side AI analysis');

    const malformedId = await fetch(`http://localhost:${port}/api/issues/not-a-uuid/ai-analysis`, { headers: auth(ownerToken) });
    check(malformedId.status === 400, 'malformed issue ID is rejected before authorization lookup');

    const authorized = await fetch(endpoint, { headers: auth(ownerToken) });
    const authorizedBody = await authorized.json() as { success: boolean; data?: { analysis?: { status: string; structuredResult?: unknown }; error?: string } };
    check(authorized.status === 200 && authorizedBody.success, 'authorized organization role can access AI analysis');
    check(authorizedBody.data?.analysis?.status === 'COMPLETED', 'successful analysis is persisted and returned');
    check(!JSON.stringify(authorizedBody).includes('provider secret'), 'raw provider errors are not exposed by the API');
    check(!JSON.stringify(authorizedBody).includes('GROQ_API_KEY'), 'Groq API key is never returned by the API');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  const frontendSource = fs.readFileSync(path.resolve(process.cwd(), '../frontend/components/issues/AIIntelligenceCard.tsx'), 'utf8');
  check(!frontendSource.includes('GROQ_API_KEY'), 'frontend AI card contains no provider API key');
  setIssueIntelligenceProviderForTests(null);
  console.log(`Issue Intelligence tests: ${passed}/${passed} PASS`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
