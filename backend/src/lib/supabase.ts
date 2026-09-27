// ==============================================================================
// CivicFix - Server-Only Supabase Client & Storage Utilities
// CRITICAL SECURITY NOTE:
// This file is strictly for backend execution.
// It uses SUPABASE_SERVICE_ROLE_KEY to administer private Supabase Storage buckets.
// It must NEVER be imported into frontend code or exposed in browser bundles.
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

export const STORAGE_BUCKET = 'issue-images';

export const isStorageConfigured = (): boolean =>
  Boolean(
    config.supabaseUrl &&
      config.supabaseUrl.trim() !== '' &&
      config.supabaseServiceRoleKey &&
      config.supabaseServiceRoleKey.trim() !== ''
  );

// Server-only singleton Supabase client
let supabaseClientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isStorageConfigured()) {
    return null;
  }

  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return supabaseClientInstance;
}

// ==============================================================================
// In-Memory Storage Fallback (Offline / Test / Demo Environment)
// Ensures 100% of validation, authorization, and error handling logic can be tested
// without failing when live Supabase credentials are not locally configured.
// ==============================================================================

interface MockStorageObject {
  storagePath: string;
  buffer: Buffer;
  mimeType: string;
  uploadedAt: Date;
}

const mockStorageMap = new Map<string, MockStorageObject>();

export function getMockStorageMap(): Map<string, MockStorageObject> {
  return mockStorageMap;
}

export function resetMockStorage(): void {
  mockStorageMap.clear();
}

// ==============================================================================
// Storage Operations
// ==============================================================================

export interface StorageUploadResult {
  success: boolean;
  storagePath?: string;
  error?: string;
  isMock?: boolean;
}

export interface StorageSignedUrlResult {
  success: boolean;
  signedUrl?: string;
  error?: string;
  isMock?: boolean;
}

export interface StorageDeleteResult {
  success: boolean;
  error?: string;
  isMock?: boolean;
}

/**
 * Uploads an image binary buffer to the private `issue-images` bucket.
 * Handles both live Supabase Storage and offline test fallback.
 */
export async function uploadFileToStorage(
  storagePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<StorageUploadResult> {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (error) {
        return {
          success: false,
          error: error.message || 'Supabase storage upload failed.',
          isMock: false,
        };
      }

      return {
        success: true,
        storagePath: data?.path || storagePath,
        isMock: false,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Exception occurred during Supabase storage upload.',
        isMock: false,
      };
    }
  }

  // In-memory fallback
  mockStorageMap.set(storagePath, {
    storagePath,
    buffer,
    mimeType,
    uploadedAt: new Date(),
  });

  return {
    success: true,
    storagePath,
    isMock: true,
  };
}

/**
 * Generates a short-lived signed URL for a private storage object.
 * Default expiration: 15 minutes (900 seconds).
 */
export async function createSignedFileUrl(
  storagePath: string,
  expiresInSeconds = 900
): Promise<StorageSignedUrlResult> {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error || !data?.signedUrl) {
        return {
          success: false,
          error: error?.message || 'Failed to generate signed URL from Supabase storage.',
          isMock: false,
        };
      }

      return {
        success: true,
        signedUrl: data.signedUrl,
        isMock: false,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Exception generating signed URL.',
        isMock: false,
      };
    }
  }

  // In-memory fallback: verify object exists in mock store
  if (!mockStorageMap.has(storagePath)) {
    return {
      success: false,
      error: 'Storage object not found in mock store.',
      isMock: true,
    };
  }

  const mockToken = Buffer.from(`${storagePath}:${Date.now() + expiresInSeconds * 1000}`).toString('base64url');
  const mockSignedUrl = `https://mock-storage.civicfix.local/${STORAGE_BUCKET}/${storagePath}?token=${mockToken}&expiresIn=${expiresInSeconds}`;

  return {
    success: true,
    signedUrl: mockSignedUrl,
    isMock: true,
  };
}

/**
 * Deletes an image binary object from the private `issue-images` bucket.
 */
export async function deleteFileFromStorage(
  storagePath: string
): Promise<StorageDeleteResult> {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { error } = await client.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);

      if (error) {
        return {
          success: false,
          error: error.message || 'Failed to remove object from Supabase storage.',
          isMock: false,
        };
      }

      return {
        success: true,
        isMock: false,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Exception removing object from Supabase storage.',
        isMock: false,
      };
    }
  }

  // In-memory fallback
  mockStorageMap.delete(storagePath);
  return {
    success: true,
    isMock: true,
  };
}
