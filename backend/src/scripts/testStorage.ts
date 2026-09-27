// ==============================================================================
// CivicFix - Supabase Storage & Issue Image Upload Test Suite
// Verifies image uploads, magic bytes validation, size limits, count limits,
// path traversal protection, signed URLs, deletion, and multi-tenant isolation.
// ==============================================================================

import http from 'http';
import { app } from '../index.js';
import { generateToken } from '../services/auth.service.js';
import { UserRole } from '@prisma/client';
import { isStorageConfigured } from '../lib/supabase.js';

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

// Synthetic Valid Image Buffers
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00,
  0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08,
  0xff, 0xd9,
]);

const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

const VALID_WEBP_BUFFER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x18, 0x00, 0x00, 0x00,
  0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x34, 0x25,
]);

// Spoofed Buffer (Claims to be JPEG but contains PDF header)
const SPOOFED_PDF_BUFFER = Buffer.from('%PDF-1.4\n%Fake PDF content posing as JPEG');

// Oversized Buffer (5.5 MB > 5 MB limit)
const OVERSIZED_BUFFER = Buffer.concat([VALID_JPEG_BUFFER, Buffer.alloc(5.5 * 1024 * 1024, 0xaa)]);

async function runStorageTests() {
  console.log('\n================================================================');
  console.log(' CivicFix - Supabase Storage & Issue Image Upload Test Suite');
  console.log('================================================================\n');

  console.log(`[Storage Mode] ${isStorageConfigured() ? 'LIVE SUPABASE STORAGE' : 'MOCK / OFFLINE STORAGE (Safe Fallback)'}`);

  // Seeded User IDs
  const ORG_ADMIN_ID = 'f0000000-0000-0000-0000-000000000003';
  const STAFF_ID = 'f0000000-0000-0000-0000-000000000005';
  const USER_1_ID = 'f0000000-0000-0000-0000-000000000006'; // Reporter of STREETLIGHT_ISSUE_ID
  const USER_2_ID = 'f0000000-0000-0000-0000-000000000007'; // Reporter of POTHOLE_ISSUE_ID

  // Existing Issues
  const STREETLIGHT_ISSUE_ID = 'a1000000-0000-0000-0000-000000000001'; // User 1's issue, Electrical Dept
  const POTHOLE_ISSUE_ID = 'a1000000-0000-0000-0000-000000000002'; // User 2's issue, Civil Dept

  // Tokens
  const orgAdminToken = generateToken({ id: ORG_ADMIN_ID, role: UserRole.ORG_ADMIN });
  const staffToken = generateToken({ id: STAFF_ID, role: UserRole.STAFF });
  const user1Token = generateToken({ id: USER_1_ID, role: UserRole.USER });
  const user2Token = generateToken({ id: USER_2_ID, role: UserRole.USER });

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  let uploadedImageId = '';
  let uploadedStoragePath = '';

  try {
    // ============================================================================
    // SUITE 1: AUTHENTICATION & ACCESS CONTROL
    // ============================================================================
    console.log('\n[Suite 1] Authentication & Upload Access Control');

    // 1.1 Unauthenticated upload rejected -> 401
    const formDataUnauth = new FormData();
    formDataUnauth.append('image', new Blob([VALID_JPEG_BUFFER], { type: 'image/jpeg' }), 'test.jpg');
    const unauthRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      body: formDataUnauth,
    });
    assert(unauthRes.status === 401, 'Unauthenticated POST /api/issues/:id/images rejected (401 Unauthorized)');

    // 1.2 Non-existent issue returns 404
    const formData404 = new FormData();
    formData404.append('image', new Blob([VALID_JPEG_BUFFER], { type: 'image/jpeg' }), 'test.jpg');
    const notFoundRes = await fetch(`${baseUrl}/api/issues/a1000000-0000-0000-0000-000000000099/images`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: formData404,
    });
    assert(notFoundRes.status === 404, 'Upload to non-existent issue returns 404 Not Found');

    // 1.3 Unauthorized citizen User 2 upload to User 1's issue rejected -> 403 Forbidden
    const formDataIdor = new FormData();
    formDataIdor.append('image', new Blob([VALID_JPEG_BUFFER], { type: 'image/jpeg' }), 'test.jpg');
    const idorRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user2Token),
      body: formDataIdor,
    });
    assert(idorRes.status === 403, 'Permission Guard: Citizen cannot upload images to another user issue (403 Forbidden)');

    // 1.4 Authorized citizen User 1 uploads valid JPEG to own issue -> 201 Created
    const formDataValid = new FormData();
    formDataValid.append('image', new Blob([VALID_JPEG_BUFFER], { type: 'image/jpeg' }), 'walkway_lamp.jpg');
    formDataValid.append('isPrimary', 'true');
    const validUploadRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: formDataValid,
    });
    const validUploadJson = (await validUploadRes.json()) as any;
    assert(validUploadRes.status === 201, 'Authorized USER uploads JPEG to own issue (201 Created)');
    assert(Boolean(validUploadJson.data?.id), 'Response contains generated image ID');
    assert(validUploadJson.data?.isPrimary === true, 'Image marked as primary');
    assert(validUploadJson.data?.mimeType === 'image/jpeg', 'Image mimeType recorded as image/jpeg');
    assert(Boolean(validUploadJson.data?.signedUrl), 'Response provides short-lived signed URL for preview');
    uploadedImageId = validUploadJson.data?.id;
    uploadedStoragePath = validUploadJson.data?.storagePath;
    assert(Boolean(uploadedStoragePath), 'Storage path generated and recorded');

    // 1.5 Security: Service role key never exposed in response
    const rawResponseBody = JSON.stringify(validUploadJson);
    assert(!rawResponseBody.includes('service_role'), 'Security: service_role key not exposed in upload response');

    // 1.6 Authorized Staff uploads image to assigned issue -> 201 Created
    // STAFF_ID is assigned to STREETLIGHT_ISSUE_ID
    const formDataStaff = new FormData();
    formDataStaff.append('image', new Blob([VALID_JPEG_BUFFER], { type: 'image/jpeg' }), 'repair_work.jpg');
    const staffUploadRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(staffToken),
      body: formDataStaff,
    });
    assert(staffUploadRes.status === 201, 'Authorized STAFF uploads image to assigned issue (201 Created)');

    // ============================================================================
    // SUITE 2: FILE VALIDATION, MIME & MAGIC BYTE SECURITY
    // ============================================================================
    console.log('\n[Suite 2] File Validation, MIME & Magic Byte Security');

    // 2.1 Missing file payload rejected -> 400 Bad Request
    const formDataEmpty = new FormData();
    const emptyRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: formDataEmpty,
    });
    assert(emptyRes.status === 400, 'Missing image field rejected (400 Bad Request)');

    // 2.2 Disallowed MIME type (application/pdf) rejected -> 400 Bad Request
    const formDataPdf = new FormData();
    formDataPdf.append('image', new Blob([SPOOFED_PDF_BUFFER], { type: 'application/pdf' }), 'document.pdf');
    const pdfRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: formDataPdf,
    });
    assert(pdfRes.status === 400, 'Disallowed MIME type application/pdf rejected (400 Bad Request)');

    // 2.3 MIME Spoofing: Client declares image/jpeg but content is PDF -> 400 Bad Request
    const formDataSpoof = new FormData();
    formDataSpoof.append('image', new Blob([SPOOFED_PDF_BUFFER], { type: 'image/jpeg' }), 'malicious.jpg');
    const spoofRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: formDataSpoof,
    });
    assert(spoofRes.status === 400, 'MIME Spoofing Guard: Buffer signature mismatch detected and rejected (400 Bad Request)');

    // 2.4 Valid PNG with authentic magic bytes accepted -> 201 Created
    const formDataPng = new FormData();
    formDataPng.append('image', new Blob([VALID_PNG_BUFFER], { type: 'image/png' }), 'circuit_diagram.png');
    const pngRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: formDataPng,
    });
    assert(pngRes.status === 201, 'Valid PNG upload accepted (201 Created)');

    // 2.5 Valid WebP with authentic magic bytes accepted -> 201 Created
    const formDataWebp = new FormData();
    formDataWebp.append('image', new Blob([VALID_WEBP_BUFFER], { type: 'image/webp' }), 'compressed_photo.webp');
    const webpRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: formDataWebp,
    });
    assert(webpRes.status === 201, 'Valid WebP upload accepted (201 Created)');

    // ============================================================================
    // SUITE 3: FILE SIZE & IMAGE COUNT LIMITS
    // ============================================================================
    console.log('\n[Suite 3] File Size & Image Count Limits');

    // 3.1 Oversized image (> 5 MB) rejected -> 413 Payload Too Large
    const formDataLarge = new FormData();
    formDataLarge.append('image', new Blob([OVERSIZED_BUFFER], { type: 'image/jpeg' }), 'huge_photo.jpg');
    const largeRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: formDataLarge,
    });
    assert(largeRes.status === 413, 'File Size Guard: Image > 5 MB rejected (413 Payload Too Large)');

    // 3.2 Maximum 5 images per issue limit
    // We already uploaded 4 images (1.4, 1.6, 2.4, 2.5). Upload 5th:
    const formData5th = new FormData();
    formData5th.append('image', new Blob([VALID_JPEG_BUFFER], { type: 'image/jpeg' }), 'photo5.jpg');
    const res5th = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: formData5th,
    });
    assert(res5th.status === 201, '5th image uploaded successfully (count = 5)');

    // Attempting 6th image -> should be rejected with 400 Bad Request
    const formData6th = new FormData();
    formData6th.append('image', new Blob([VALID_JPEG_BUFFER], { type: 'image/jpeg' }), 'photo6.jpg');
    const res6th = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user1Token),
      body: formData6th,
    });
    assert(res6th.status === 400, 'Image Count Guard: 6th image rejected (maximum limit 5 enforced)');

    // ============================================================================
    // SUITE 4: STORAGE PATH SAFETY & ANTI-TRAVERSAL
    // ============================================================================
    console.log('\n[Suite 4] Storage Path Safety & Anti-Traversal');

    // 4.1 Path traversal filename attempt: ../../secret.jpg
    // Let's test on POTHOLE_ISSUE_ID (has 0 images so far)
    const formDataTraversal = new FormData();
    formDataTraversal.append('image', new Blob([VALID_JPEG_BUFFER], { type: 'image/jpeg' }), '../../etc/passwd.jpg');
    const traversalRes = await fetch(`${baseUrl}/api/issues/${POTHOLE_ISSUE_ID}/images`, {
      method: 'POST',
      headers: authHeader(user2Token),
      body: formDataTraversal,
    });
    const traversalJson = (await traversalRes.json()) as any;
    assert(traversalRes.status === 201, 'Upload with path traversal characters sanitized successfully (201 Created)');
    assert(!traversalJson.data?.storagePath?.includes('..'), 'Path Traversal Guard: ".." completely stripped from storage path');
    assert(
      traversalJson.data?.storagePath?.startsWith(`issues/${POTHOLE_ISSUE_ID}/`),
      'Storage path strictly follows "issues/{issueId}/{uuid}-{name}" format'
    );

    // ============================================================================
    // SUITE 5: IMAGE LISTING & SIGNED URLS
    // ============================================================================
    console.log('\n[Suite 5] Image Listing & Signed URLs');

    // 5.1 GET /api/issues/:id/images returns array with signed URLs
    const listRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      headers: authHeader(user1Token),
    });
    const listJson = (await listRes.json()) as any;
    assert(listRes.status === 200, 'GET /api/issues/:id/images returns 200 OK');
    assert(Array.isArray(listJson.data), 'Images returned as array');
    assert(listJson.data?.length === 5, 'Returns all 5 uploaded images');
    assert(Boolean(listJson.data[0]?.signedUrl), 'Each image item includes a short-lived signedUrl');

    // 5.2 Citizen User 2 denied listing images of User 1's private issue -> 403 Forbidden
    const idorListRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      headers: authHeader(user2Token),
    });
    assert(idorListRes.status === 403, 'IDOR Guard: Unauthorized citizen denied from listing another user images (403)');

    // 5.3 GET /api/issues/:issueId/images/:imageId/url returns fresh signed URL -> 200 OK
    const signedUrlRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images/${uploadedImageId}/url`, {
      headers: authHeader(user1Token),
    });
    const signedUrlJson = (await signedUrlRes.json()) as any;
    assert(signedUrlRes.status === 200, 'GET /api/issues/:id/images/:imageId/url returns 200 OK');
    assert(Boolean(signedUrlJson.data?.signedUrl), 'Response contains signedUrl');
    assert(signedUrlJson.data?.expiresInSeconds === 900, 'Expiration is set to 900 seconds (15 minutes)');

    // 5.4 Cross-issue access: using uploadedImageId with POTHOLE_ISSUE_ID -> 404 Not Found
    const crossIssueRes = await fetch(`${baseUrl}/api/issues/${POTHOLE_ISSUE_ID}/images/${uploadedImageId}/url`, {
      headers: authHeader(orgAdminToken),
    });
    assert(crossIssueRes.status === 404, 'Cross-Issue Guard: Image ID from Issue A requested under Issue B returns 404');

    // ============================================================================
    // SUITE 6: IMAGE DELETION & AUTHORIZATION
    // ============================================================================
    console.log('\n[Suite 6] Image Deletion & Authorization');

    // 6.1 Unauthorized User 2 cannot delete User 1's image -> 403 Forbidden
    const unauthDeleteRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images/${uploadedImageId}`, {
      method: 'DELETE',
      headers: authHeader(user2Token),
    });
    assert(unauthDeleteRes.status === 403, 'Permission Guard: Unauthorized user cannot delete image (403 Forbidden)');

    // 6.2 Staff cannot arbitrarily delete images -> 403 Forbidden
    const staffDeleteRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images/${uploadedImageId}`, {
      method: 'DELETE',
      headers: authHeader(staffToken),
    });
    assert(staffDeleteRes.status === 403, 'Authority Guard: Field STAFF forbidden from deleting image (403 Forbidden)');

    // 6.3 Authorized reporter User 1 deletes their own image -> 200 OK
    const ownerDeleteRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images/${uploadedImageId}`, {
      method: 'DELETE',
      headers: authHeader(user1Token),
    });
    assert(ownerDeleteRes.status === 200, 'Authorized reporter deletes own image (200 OK)');

    // 6.4 Subsequent URL request for deleted image returns 404
    const deletedUrlRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images/${uploadedImageId}/url`, {
      headers: authHeader(user1Token),
    });
    assert(deletedUrlRes.status === 404, 'Deleted image cannot be accessed (404 Not Found)');

    // 6.5 Org Admin can delete images (e.g., moderation / cleanup) -> 200 OK
    // Get another image ID from the remaining 4
    const remainingListRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images`, {
      headers: authHeader(orgAdminToken),
    });
    const remainingListJson = (await remainingListRes.json()) as any;
    const anotherImageId = remainingListJson.data?.[0]?.id;
    const adminDeleteRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}/images/${anotherImageId}`, {
      method: 'DELETE',
      headers: authHeader(orgAdminToken),
    });
    assert(adminDeleteRes.status === 200, 'ORG_ADMIN can delete image for administrative moderation (200 OK)');

    // ============================================================================
    // SUITE 7: PRESERVATION OF PREVIOUS ENDPOINTS
    // ============================================================================
    console.log('\n[Suite 7] Preservation of Prompts 1-10 Endpoints');

    // 7.1 GET /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert(healthRes.status === 200, 'GET /api/health continues to return 200 OK');

    // 7.2 GET /api/auth/me
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: authHeader(user1Token),
    });
    assert(meRes.status === 200, 'GET /api/auth/me continues to return 200 OK');

    // 7.3 GET /api/issues/:issueId
    const issueRes = await fetch(`${baseUrl}/api/issues/${STREETLIGHT_ISSUE_ID}`, {
      headers: authHeader(user1Token),
    });
    assert(issueRes.status === 200, 'GET /api/issues/:id continues to return 200 OK');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n================================================================');
  console.log(` Storage Test Results: ${passed}/${results.length} PASSED`);
  if (failed > 0) {
    console.error(` ${failed} TESTS FAILED!`);
    process.exit(1);
  } else {
    console.log(' ALL 30+ SUPABASE STORAGE & ISSUE IMAGE TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  }
}

runStorageTests().catch((err) => {
  console.error('Fatal error during storage tests:', err);
  process.exit(1);
});
