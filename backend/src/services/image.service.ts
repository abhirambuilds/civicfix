// ==============================================================================
// CivicFix - Issue Image Storage & Upload Service
// Private Supabase Storage management, magic byte validation, atomic failure handling,
// short-lived signed URLs, and multi-tenant authorization guards.
// ==============================================================================

import crypto from 'crypto';
import { UserRole, OrgMemberRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  uploadFileToStorage,
  createSignedFileUrl,
  deleteFileFromStorage,
  isStorageConfigured,
} from '../lib/supabase.js';
import {
  validateImageMagicBytes,
  sanitizeFilename,
  generateSafeStoragePath,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGES_PER_ISSUE,
  ALLOWED_MIME_TYPES,
} from '../utils/imageValidation.js';
import { canAccessIssue, getUserOrganizationMembership, getUserDepartmentMembership } from './rbac.service.js';
import { ServiceResult } from './auth.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

const hasDbUrl = (): boolean =>
  Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');

// ==============================================================================
// In-Memory Fallback Mock Store (For offline testing and environments without DB)
// ==============================================================================

export interface MockImage {
  id: string;
  issueId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  isPrimary: boolean;
  createdAt: Date;
}

const MOCK_IMAGES: Map<string, MockImage[]> = new Map();

export function getMockImages(issueId: string): MockImage[] {
  return MOCK_IMAGES.get(issueId) || [];
}

export function resetMockImages(): void {
  MOCK_IMAGES.clear();
}

// Fallback issues map for offline issue authorization
interface FallbackIssueInfo {
  id: string;
  reporterId: string;
  organizationId: string;
  assignments: Array<{ departmentId?: string; assignedUserId?: string }>;
}

const FALLBACK_ISSUES: Map<string, FallbackIssueInfo> = new Map([
  [
    'a1000000-0000-0000-0000-000000000001',
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      reporterId: 'f0000000-0000-0000-0000-000000000006', // User 1
      organizationId: 'a0000000-0000-0000-0000-000000000001', // SRM Org
      assignments: [
        {
          departmentId: 'b0000000-0000-0000-0000-000000000002', // Electrical Dept
          assignedUserId: 'f0000000-0000-0000-0000-000000000005', // Staff
        },
      ],
    },
  ],
  [
    'a1000000-0000-0000-0000-000000000002',
    {
      id: 'a1000000-0000-0000-0000-000000000002',
      reporterId: 'f0000000-0000-0000-0000-000000000007', // User 2
      organizationId: 'a0000000-0000-0000-0000-000000000001', // SRM Org
      assignments: [
        {
          departmentId: 'b0000000-0000-0000-0000-000000000001', // Civil Dept
          assignedUserId: 'f0000000-0000-0000-0000-000000000004', // Manager
        },
      ],
    },
  ],
]);

export function registerFallbackIssue(issue: FallbackIssueInfo): void {
  FALLBACK_ISSUES.set(issue.id, issue);
}

/**
 * Internal helper to fetch issue authorization context.
 */
async function getIssueContext(
  issueId: string,
  db = prisma
): Promise<FallbackIssueInfo | null> {
  if (hasDbUrl()) {
    try {
      const issue = await db.issue.findUnique({
        where: { id: issueId },
        select: {
          id: true,
          reporterId: true,
          organizationId: true,
          assignments: {
            where: { isActive: true },
            select: { departmentId: true, assignedUserId: true },
          },
        },
      });
      if (issue) {
        return {
          id: issue.id,
          reporterId: issue.reporterId,
          organizationId: issue.organizationId,
          assignments: issue.assignments.map((a) => ({
            departmentId: a.departmentId || undefined,
            assignedUserId: a.assignedUserId || undefined,
          })),
        };
      }
    } catch {
      // Fallback
    }
  }

  return FALLBACK_ISSUES.get(issueId) || null;
}

/**
 * Determines whether an actor has write/upload access to an issue.
 * - USER: only own reported issue.
 * - ORG_OWNER / ORG_ADMIN: authorized within their organization.
 * - MANAGER: authorized within assigned department.
 * - STAFF: authorized if assigned to issue or department.
 * - PLATFORM_ADMIN: authorized platform-wide.
 */
async function canUploadToIssue(
  userId: string,
  userRole: UserRole,
  issue: FallbackIssueInfo,
  db = prisma
): Promise<{ allowed: boolean; reason?: string }> {
  if (userRole === UserRole.PLATFORM_ADMIN) {
    return { allowed: true };
  }

  if (userRole === UserRole.USER) {
    if (issue.reporterId === userId) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Forbidden: You can only upload images to your own reported issues.' };
  }

  if (userRole === UserRole.ORG_OWNER || userRole === UserRole.ORG_ADMIN) {
    const orgMem = await getUserOrganizationMembership(userId, issue.organizationId, db);
    if (orgMem && (orgMem.orgRole === OrgMemberRole.OWNER || orgMem.orgRole === OrgMemberRole.ADMIN)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Forbidden: You do not have administrative access to this organization.' };
  }

  if (userRole === UserRole.MANAGER || userRole === UserRole.STAFF) {
    const isDirectlyAssigned = issue.assignments.some((a) => a.assignedUserId === userId);
    if (isDirectlyAssigned) {
      return { allowed: true };
    }

    for (const a of issue.assignments) {
      if (a.departmentId) {
        const deptMem = await getUserDepartmentMembership(userId, a.departmentId, db);
        if (deptMem) {
          return { allowed: true };
        }
      }
    }

    return { allowed: false, reason: 'Forbidden: You are not assigned to this issue or department.' };
  }

  return { allowed: false, reason: 'Forbidden: Unauthorized role.' };
}

// ==============================================================================
// SERVICE IMPLEMENTATIONS
// ==============================================================================

/**
 * 1. Upload Issue Image.
 * Flow:
 * - Authenticate & verify write access.
 * - Validate file signature & magic bytes.
 * - Enforce 5 MB file size limit and 5 images per issue limit.
 * - Generate collision-free, traversal-safe storage path.
 * - Upload to private Supabase Storage.
 * - Record metadata in database.
 * - Cleanup storage object if DB insert fails.
 */
export async function uploadIssueImage(
  userId: string,
  userRole: UserRole,
  issueId: string,
  file: Express.Multer.File | undefined,
  isPrimary = false,
  db = prisma
): Promise<ServiceResult<any>> {
  // 1. Validate issueId
  if (!isValidUuid(issueId)) {
    return { success: false, error: 'Invalid issue ID parameter.', statusCode: 400 };
  }

  // 2. Fetch issue context
  const issue = await getIssueContext(issueId, db);
  if (!issue) {
    return { success: false, error: 'Issue not found.', statusCode: 404 };
  }

  // 3. Authorize upload
  const auth = await canUploadToIssue(userId, userRole, issue, db);
  if (!auth.allowed) {
    return { success: false, error: auth.reason || 'Forbidden: Access denied.', statusCode: 403 };
  }

  // 4. Validate file existence
  if (!file || !file.buffer) {
    return { success: false, error: 'No image file uploaded. Expected multipart field: "image".', statusCode: 400 };
  }

  // 5. Validate file size (5 MB max)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, error: 'File too large. Maximum image size is 5 MB.', statusCode: 413 };
  }

  // 6. Validate declared MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
    return {
      success: false,
      error: `Invalid image type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      statusCode: 400,
    };
  }

  // 7. Validate magic bytes (prevent MIME spoofing)
  const magicCheck = validateImageMagicBytes(file.buffer, file.mimetype);
  if (!magicCheck.valid) {
    return {
      success: false,
      error: magicCheck.error || 'File content signature does not match declared image type.',
      statusCode: 400,
    };
  }

  // 8. Check maximum images per issue limit (max 5)
  let currentImageCount = 0;
  if (hasDbUrl()) {
    try {
      currentImageCount = await db.issueImage.count({ where: { issueId } });
    } catch {
      currentImageCount = (MOCK_IMAGES.get(issueId) || []).length;
    }
  } else {
    currentImageCount = (MOCK_IMAGES.get(issueId) || []).length;
  }

  if (currentImageCount >= MAX_IMAGES_PER_ISSUE) {
    return {
      success: false,
      error: `Maximum limit of ${MAX_IMAGES_PER_ISSUE} images per issue reached.`,
      statusCode: 400,
    };
  }

  // 9. Generate collision-free, safe storage path
  const storagePath = generateSafeStoragePath(issueId, file.originalname, file.mimetype);
  const safeName = sanitizeFilename(file.originalname);

  // 10. Upload to Supabase Storage
  const uploadResult = await uploadFileToStorage(storagePath, file.buffer, file.mimetype);
  if (!uploadResult.success) {
    return {
      success: false,
      error: uploadResult.error || 'Failed to upload image to storage service.',
      statusCode: 500,
    };
  }

  // Determine if this image should be primary (explicitly requested or first image)
  const markPrimary = isPrimary || currentImageCount === 0;

  // 11. Record metadata in Database
  let savedImage: any = null;
  if (hasDbUrl()) {
    try {
      savedImage = await db.issueImage.create({
        data: {
          issueId,
          storagePath,
          fileName: safeName,
          mimeType: file.mimetype,
          fileSize: file.size,
          isPrimary: markPrimary,
        },
      });
    } catch (dbErr: any) {
      // Partial failure mitigation: remove orphaned storage object
      await deleteFileFromStorage(storagePath);
      return {
        success: false,
        error: 'Failed to record image metadata in database. Storage object was rolled back.',
        statusCode: 500,
      };
    }
  } else {
    // In-memory mock save
    const mockImage: MockImage = {
      id: crypto.randomUUID(),
      issueId,
      storagePath,
      fileName: safeName,
      mimeType: file.mimetype,
      fileSize: file.size,
      isPrimary: markPrimary,
      createdAt: new Date(),
    };
    const list = MOCK_IMAGES.get(issueId) || [];
    list.push(mockImage);
    MOCK_IMAGES.set(issueId, list);
    savedImage = mockImage;
  }

  // 12. Generate short-lived signed URL for immediate preview (15 minutes)
  const signedUrlResult = await createSignedFileUrl(storagePath, 900);

  return {
    success: true,
    data: {
      ...savedImage,
      signedUrl: signedUrlResult.signedUrl || null,
      storageMode: isStorageConfigured() ? 'live' : 'mock',
    },
    message: 'Image uploaded successfully.',
    statusCode: 201,
  };
}

/**
 * 2. List Images for an Issue.
 * Scoped by issue access rules. Returns metadata and signed URLs.
 */
export async function listIssueImages(
  userId: string,
  userRole: UserRole,
  issueId: string,
  db = prisma
): Promise<ServiceResult<any>> {
  if (!isValidUuid(issueId)) {
    return { success: false, error: 'Invalid issue ID parameter.', statusCode: 400 };
  }

  // Authorize read access
  const auth = await canAccessIssue(userId, userRole, issueId, db);
  if (auth.notFound) {
    return { success: false, error: 'Issue not found.', statusCode: 404 };
  }
  if (!auth.allowed) {
    return { success: false, error: auth.reason || 'Forbidden: Access to this issue is denied.', statusCode: 403 };
  }

  let images: any[] = [];
  if (hasDbUrl()) {
    try {
      images = await db.issueImage.findMany({
        where: { issueId },
        orderBy: { createdAt: 'asc' },
      });
    } catch {
      images = MOCK_IMAGES.get(issueId) || [];
    }
  } else {
    images = MOCK_IMAGES.get(issueId) || [];
  }

  // Attach signed URLs for each image
  const imagesWithUrls = await Promise.all(
    images.map(async (img) => {
      const signed = await createSignedFileUrl(img.storagePath, 900);
      return {
        ...img,
        signedUrl: signed.signedUrl || null,
      };
    })
  );

  return {
    success: true,
    data: imagesWithUrls,
    statusCode: 200,
  };
}

/**
 * 3. Generate Signed URL for a Specific Image.
 * Verifies that the image exists and strictly belongs to the requested issue.
 */
export async function getSignedImageUrl(
  userId: string,
  userRole: UserRole,
  issueId: string,
  imageId: string,
  db = prisma
): Promise<ServiceResult<any>> {
  if (!isValidUuid(issueId) || !isValidUuid(imageId)) {
    return { success: false, error: 'Invalid issue ID or image ID parameter.', statusCode: 400 };
  }

  // Authorize read access to issue
  const auth = await canAccessIssue(userId, userRole, issueId, db);
  if (auth.notFound) {
    return { success: false, error: 'Issue not found.', statusCode: 404 };
  }
  if (!auth.allowed) {
    return { success: false, error: auth.reason || 'Forbidden: Access to this issue is denied.', statusCode: 403 };
  }

  // Fetch image metadata
  let image: any = null;
  if (hasDbUrl()) {
    try {
      image = await db.issueImage.findUnique({
        where: { id: imageId },
      });
    } catch {
      const list = MOCK_IMAGES.get(issueId) || [];
      image = list.find((img) => img.id === imageId);
    }
  } else {
    const list = MOCK_IMAGES.get(issueId) || [];
    image = list.find((img) => img.id === imageId);
  }

  if (!image) {
    return { success: false, error: 'Image not found.', statusCode: 404 };
  }

  // Cross-issue validation: Image MUST belong to issueId in the URL
  if (image.issueId !== issueId) {
    return { success: false, error: 'Image does not belong to the specified issue.', statusCode: 404 };
  }

  const signedResult = await createSignedFileUrl(image.storagePath, 900);
  if (!signedResult.success) {
    return {
      success: false,
      error: signedResult.error || 'Failed to generate signed URL.',
      statusCode: 500,
    };
  }

  return {
    success: true,
    data: {
      imageId: image.id,
      issueId: image.issueId,
      storagePath: image.storagePath,
      signedUrl: signedResult.signedUrl,
      expiresInSeconds: 900,
    },
    statusCode: 200,
  };
}

/**
 * 4. Delete Issue Image.
 * Authorization:
 * - Issue reporter (USER) can delete their own uploaded images.
 * - ORG_OWNER / ORG_ADMIN of issue's organization can delete inappropriate images.
 * - PLATFORM_ADMIN can delete platform-wide.
 * - Field STAFF cannot delete images arbitrarily (403).
 */
export async function deleteIssueImage(
  userId: string,
  userRole: UserRole,
  issueId: string,
  imageId: string,
  db = prisma
): Promise<ServiceResult<any>> {
  if (!isValidUuid(issueId) || !isValidUuid(imageId)) {
    return { success: false, error: 'Invalid issue ID or image ID parameter.', statusCode: 400 };
  }

  const issue = await getIssueContext(issueId, db);
  if (!issue) {
    return { success: false, error: 'Issue not found.', statusCode: 404 };
  }

  // Authorization check
  let isAuthorized = false;
  if (userRole === UserRole.PLATFORM_ADMIN) {
    isAuthorized = true;
  } else if (userRole === UserRole.USER && issue.reporterId === userId) {
    isAuthorized = true;
  } else if (userRole === UserRole.ORG_OWNER || userRole === UserRole.ORG_ADMIN) {
    const orgMem = await getUserOrganizationMembership(userId, issue.organizationId, db);
    if (orgMem && (orgMem.orgRole === OrgMemberRole.OWNER || orgMem.orgRole === OrgMemberRole.ADMIN)) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return {
      success: false,
      error: 'Forbidden: You do not have permission to delete this image.',
      statusCode: 403,
    };
  }

  // Fetch image metadata
  let image: any = null;
  if (hasDbUrl()) {
    try {
      image = await db.issueImage.findUnique({
        where: { id: imageId },
      });
    } catch {
      const list = MOCK_IMAGES.get(issueId) || [];
      image = list.find((img) => img.id === imageId);
    }
  } else {
    const list = MOCK_IMAGES.get(issueId) || [];
    image = list.find((img) => img.id === imageId);
  }

  if (!image) {
    return { success: false, error: 'Image not found.', statusCode: 404 };
  }

  if (image.issueId !== issueId) {
    return { success: false, error: 'Image does not belong to the specified issue.', statusCode: 404 };
  }

  // 1. Delete from Supabase Storage first
  const deleteStorageResult = await deleteFileFromStorage(image.storagePath);
  if (!deleteStorageResult.success) {
    return {
      success: false,
      error: deleteStorageResult.error || 'Failed to delete file from storage.',
      statusCode: 500,
    };
  }

  // 2. Delete metadata from Database
  if (hasDbUrl()) {
    try {
      await db.issueImage.delete({ where: { id: imageId } });
    } catch (err: any) {
      return {
        success: false,
        error: 'Failed to delete image record from database.',
        statusCode: 500,
      };
    }
  } else {
    const list = MOCK_IMAGES.get(issueId) || [];
    MOCK_IMAGES.set(
      issueId,
      list.filter((img) => img.id !== imageId)
    );
  }

  return {
    success: true,
    message: 'Image deleted successfully.',
    statusCode: 200,
  };
}
