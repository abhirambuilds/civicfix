import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { app } from '../index.js';
import { config } from '../config/env.js';
import { generateToken, verifyToken } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';

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

async function runTests() {
  console.log('\n================================================================');
  console.log(' CivicFix - Authentication & Security Test Suite');
  console.log('================================================================\n');

  // ============================================================================
  // 1. REGISTRATION VALIDATION TESTS
  // ============================================================================
  console.log('[Suite 1] Registration Validation & Privilege Escalation Guards');

  // 1.1 Valid registration
  const validReg = registerSchema.safeParse({
    name: 'Normal Citizen',
    email: 'citizen@example.com',
    password: 'SecurePassword123!',
  });
  assert(validReg.success, 'Valid registration payload accepted');

  // 1.2 Missing email
  const missingEmail = registerSchema.safeParse({
    name: 'Citizen',
    password: 'SecurePassword123!',
  });
  assert(!missingEmail.success, 'Missing email rejected');

  // 1.3 Invalid email
  const invalidEmail = registerSchema.safeParse({
    name: 'Citizen',
    email: 'not-an-email',
    password: 'SecurePassword123!',
  });
  assert(!invalidEmail.success, 'Invalid email format rejected');

  // 1.4 Short password (< 8 chars)
  const shortPass = registerSchema.safeParse({
    name: 'Citizen',
    email: 'user@example.com',
    password: '123',
  });
  assert(!shortPass.success, 'Short password (<8 chars) rejected');

  // 1.5 Missing password
  const missingPass = registerSchema.safeParse({
    name: 'Citizen',
    email: 'user@example.com',
  });
  assert(!missingPass.success, 'Missing password rejected');

  // 1.6 Attempt to register with PLATFORM_ADMIN role
  const adminInjection = registerSchema.safeParse({
    name: 'Hacker',
    email: 'hacker@example.com',
    password: 'SecurePassword123!',
    role: 'PLATFORM_ADMIN',
  });
  assert(
    !adminInjection.success &&
      JSON.stringify(adminInjection.error?.issues).includes('cannot specify user roles'),
    'Privilege Escalation Guard: Registration with PLATFORM_ADMIN rejected'
  );

  // 1.7 Attempt to register with ORG_ADMIN role
  const orgAdminInjection = registerSchema.safeParse({
    name: 'Hacker',
    email: 'hacker@example.com',
    password: 'SecurePassword123!',
    role: 'ORG_ADMIN',
  });
  assert(
    !orgAdminInjection.success &&
      JSON.stringify(orgAdminInjection.error?.issues).includes('cannot specify user roles'),
    'Privilege Escalation Guard: Registration with ORG_ADMIN rejected'
  );

  // 1.8 Attempt to register with organizationId
  const orgInjection = registerSchema.safeParse({
    name: 'Hacker',
    email: 'hacker@example.com',
    password: 'SecurePassword123!',
    organizationId: 'a0000000-0000-0000-0000-000000000001',
  });
  assert(!orgInjection.success, 'Organization assignment injection rejected');

  // ============================================================================
  // 2. LOGIN VALIDATION TESTS
  // ============================================================================
  console.log('\n[Suite 2] Login Validation Tests');

  const validLogin = loginSchema.safeParse({
    email: 'user@example.com',
    password: 'Password123',
  });
  assert(validLogin.success, 'Valid login payload accepted');

  const invalidLoginEmail = loginSchema.safeParse({
    email: 'invalid-email',
    password: 'Password123',
  });
  assert(!invalidLoginEmail.success, 'Invalid email in login rejected');

  const emptyLoginPassword = loginSchema.safeParse({
    email: 'user@example.com',
    password: '',
  });
  assert(!emptyLoginPassword.success, 'Empty password in login rejected');

  // ============================================================================
  // 3. PASSWORD HASHING & SECURITY TESTS
  // ============================================================================
  console.log('\n[Suite 3] Bcrypt Password Hashing & Verification');

  const plainPassword = 'SuperSecretPassword2026!';
  const hash = await bcrypt.hash(plainPassword, 10);

  assert(hash.startsWith('$2b$') || hash.startsWith('$2a$'), 'Bcrypt hash generated with valid version prefix');
  assert(hash.length === 60, 'Bcrypt hash has standard 60-character length');
  assert(hash !== plainPassword, 'Password is never stored in plaintext');

  const correctMatch = await bcrypt.compare(plainPassword, hash);
  assert(correctMatch === true, 'Bcrypt correctly verifies authentic password');

  const wrongMatch = await bcrypt.compare('WrongPassword123!', hash);
  assert(wrongMatch === false, 'Bcrypt correctly rejects incorrect password');

  // ============================================================================
  // 4. JWT CREATION, VERIFICATION & SECURITY
  // ============================================================================
  console.log('\n[Suite 4] JWT Token Security & Lifecycles');

  // 4.1 Valid token generation & decoding
  const testUserId = 'f0000000-0000-0000-0000-000000000006';
  const validToken = generateToken({ id: testUserId, role: UserRole.USER });
  const decoded = verifyToken(validToken);

  assert(decoded.sub === testUserId, 'JWT payload contains correct subject (user ID)');
  assert(decoded.role === UserRole.USER, 'JWT payload contains correct role');
  assert(typeof decoded.exp === 'number', 'JWT contains expiration timestamp');

  // Verify no password/hashes in token payload
  const rawDecoded = jwt.decode(validToken) as Record<string, unknown>;
  assert(rawDecoded.password === undefined, 'JWT does not contain password');
  assert(rawDecoded.passwordHash === undefined, 'JWT does not contain password hash');

  // 4.2 Malformed token verification
  let malformedCaught = false;
  try {
    verifyToken('this-is-not-a-jwt.token.here');
  } catch (err) {
    malformedCaught = err instanceof jwt.JsonWebTokenError;
  }
  assert(malformedCaught, 'Malformed JWT token rejected with JsonWebTokenError');

  // 4.3 Invalid signature (signed with different secret)
  const fraudulentToken = jwt.sign(
    { sub: testUserId, role: UserRole.PLATFORM_ADMIN },
    'attacker-fake-secret-key-1234567890'
  );
  let fakeSignatureCaught = false;
  try {
    verifyToken(fraudulentToken);
  } catch (err) {
    fakeSignatureCaught = err instanceof jwt.JsonWebTokenError;
  }
  assert(fakeSignatureCaught, 'Token with invalid signature rejected');

  // 4.4 Expired token verification
  const expiredToken = jwt.sign(
    { sub: testUserId, role: UserRole.USER },
    config.jwtSecret,
    { expiresIn: '0s' }
  );
  let expiredCaught = false;
  try {
    verifyToken(expiredToken);
  } catch (err) {
    expiredCaught = err instanceof jwt.TokenExpiredError;
  }
  assert(expiredCaught, 'Expired JWT token rejected with TokenExpiredError');

  // ============================================================================
  // 5. AUTHENTICATION MIDDLEWARE UNIT TESTS
  // ============================================================================
  console.log('\n[Suite 5] Authentication Middleware (requireAuth) Unit Tests');

  // 5.1 Valid Bearer token sets req.user and invokes next()
  let nextCalled: boolean = false;
  const mockReqValid = {
    headers: { authorization: `Bearer ${validToken}` },
  } as any;
  const mockRes = {
    status: () => mockRes,
    json: () => mockRes,
  } as any;
  requireAuth(mockReqValid, mockRes, () => {
    nextCalled = true;
  });
  assert((nextCalled as boolean) === true, 'requireAuth calls next() for valid Bearer token');
  assert(mockReqValid.user?.id === testUserId, 'requireAuth attaches user id to req.user');
  assert(mockReqValid.user?.role === UserRole.USER, 'requireAuth attaches user role to req.user');

  // 5.2 Missing authorization header returns 401
  let statusCaptured = 0;
  let errorMsgCaptured = '';
  const mockResFail = {
    status: (s: number) => {
      statusCaptured = s;
      return mockResFail;
    },
    json: (body: any) => {
      errorMsgCaptured = body.error || '';
      return mockResFail;
    },
  } as any;
  requireAuth({ headers: {} } as any, mockResFail, () => {});
  assert(statusCaptured === 401, 'requireAuth returns 401 when Authorization header is missing');
  assert(
    errorMsgCaptured.includes('Missing or malformed'),
    'requireAuth provides clean error message for missing header'
  );

  // 5.3 Non-Bearer scheme returns 401
  statusCaptured = 0;
  requireAuth({ headers: { authorization: 'Basic abc123xyz' } } as any, mockResFail, () => {});
  assert(statusCaptured === 401, 'requireAuth returns 401 for non-Bearer scheme');

  // 5.4 Empty token string returns 401
  statusCaptured = 0;
  requireAuth({ headers: { authorization: 'Bearer ' } } as any, mockResFail, () => {});
  assert(statusCaptured === 401, 'requireAuth returns 401 for empty token string');

  // 5.5 Expired token returns 401 with expiration message
  statusCaptured = 0;
  errorMsgCaptured = '';
  requireAuth({ headers: { authorization: `Bearer ${expiredToken}` } } as any, mockResFail, () => {});
  assert(statusCaptured === 401, 'requireAuth returns 401 for expired token');
  assert(errorMsgCaptured.includes('expired'), 'requireAuth error message indicates token expiration');

  // 5.6 Fraudulent signature returns 401
  statusCaptured = 0;
  errorMsgCaptured = '';
  requireAuth({ headers: { authorization: `Bearer ${fraudulentToken}` } } as any, mockResFail, () => {});
  assert(statusCaptured === 401, 'requireAuth returns 401 for invalid signature');
  assert(errorMsgCaptured.includes('Invalid authentication token'), 'requireAuth error message indicates invalid token');

  // ============================================================================
  // 6. HTTP ENDPOINT INTEGRATION TESTS (via In-Memory Server)
  // ============================================================================
  console.log('\n[Suite 6] HTTP Endpoint Integration Tests');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  try {
    // 5.1 GET /api/health continues to work
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = (await healthRes.json()) as any;
    assert(healthRes.status === 200, 'GET /api/health returns HTTP 200');
    assert(healthJson.data?.service === 'civicfix-backend', 'Health endpoint service identity verified');

    // 5.2 GET /api/auth/me without token -> 401
    const unauthMe = await fetch(`${baseUrl}/api/auth/me`);
    const unauthMeJson = (await unauthMe.json()) as any;
    assert(unauthMe.status === 401, 'GET /api/auth/me without token returns 401 Unauthorized');
    assert(unauthMeJson.success === false, 'Unauthenticated response indicates success=false');

    // 5.3 GET /api/auth/me with malformed token -> 401
    const badTokenMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer bad.token.here' },
    });
    assert(badTokenMe.status === 401, 'GET /api/auth/me with malformed token returns 401 Unauthorized');

    // 5.4 GET /api/auth/me with expired token -> 401
    const expiredTokenMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expiredTokenMe.status === 401, 'GET /api/auth/me with expired token returns 401 Unauthorized');

    // 5.5 GET /api/auth/me with fraudulent signature -> 401
    const fakeSignMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${fraudulentToken}` },
    });
    assert(fakeSignMe.status === 401, 'GET /api/auth/me with fraudulent signature returns 401 Unauthorized');

    // 5.6 GET /api/auth/me with empty Bearer token -> 401
    const emptyBearerMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer ' },
    });
    assert(emptyBearerMe.status === 401, 'GET /api/auth/me with empty Bearer token returns 401 Unauthorized');

    // 5.7 GET /api/auth/me with non-Bearer auth scheme -> 401
    const basicAuthMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    assert(basicAuthMe.status === 401, 'GET /api/auth/me with Basic scheme returns 401 Unauthorized');

    // 5.8 POST /api/auth/register with privilege escalation attempt -> 400
    const hackerReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker',
        email: 'attacker@evil.com',
        password: 'Password12345!',
        role: 'PLATFORM_ADMIN',
      }),
    });
    const hackerJson = (await hackerReg.json()) as any;
    assert(hackerReg.status === 400, 'POST /api/auth/register with role injection returns 400 Bad Request');
    assert(
      hackerJson.error?.includes('cannot specify user roles'),
      'Response explains privilege escalation rejection'
    );

    // 5.9 POST /api/auth/register with short password -> 400
    const shortPassReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Citizen',
        email: 'citizen@example.com',
        password: '123',
      }),
    });
    assert(shortPassReg.status === 400, 'POST /api/auth/register with short password returns 400 Bad Request');

    // 5.10 POST /api/auth/register with missing name -> 400
    const missingNameReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'citizen@example.com',
        password: 'Password123!',
      }),
    });
    assert(missingNameReg.status === 400, 'POST /api/auth/register with missing name returns 400 Bad Request');

    // 5.11 POST /api/auth/login with invalid email format -> 400
    const invalidEmailLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'Password123',
      }),
    });
    assert(invalidEmailLogin.status === 400, 'POST /api/auth/login with malformed email returns 400 Bad Request');

    // 5.12 POST /api/auth/login with missing password -> 400
    const missingPassLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'valid@example.com',
      }),
    });
    assert(missingPassLogin.status === 400, 'POST /api/auth/login with missing password returns 400 Bad Request');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  const failed = results.filter((r) => !r.passed);
  console.log('\n================================================================');
  console.log(` Test Results: ${results.length - failed.length}/${results.length} PASSED`);
  if (failed.length > 0) {
    console.error(` Failed Tests (${failed.length}):`);
    failed.forEach((f) => console.error(`  - ${f.name}: ${f.error}`));
    console.log('================================================================\n');
    process.exit(1);
  } else {
    console.log(' ALL 20+ SECURITY & AUTHENTICATION TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  }
}

runTests().catch((err) => {
  console.error('[CivicFix Auth Test] Fatal unexpected error:', err);
  process.exit(1);
});
