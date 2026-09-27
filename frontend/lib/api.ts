/**
 * CivicFix - Frontend API Client & Request Helper
 *
 * Centralized API client supporting JWT authentication, automatic token injection,
 * unified error formatting, and 401 unauthorized session expiry handling.
 */

import {
  ApiResponse,
  Issue,
  IssueListResult,
  IssueCategory,
  IssueComment,
  IssueStatusHistory,
  IssueImage,
  User,
} from '@/types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const TOKEN_STORAGE_KEY = 'civicfix_auth_token';
export const AUTH_LOGOUT_EVENT = 'civicfix:auth:logout';

/**
 * Retrieves the stored JWT token from client storage safely.
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores the JWT token in client storage.
 */
export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // LocalStorage unavailable
  }
}

/**
 * Clears the JWT token from client storage.
 */
export function removeStoredToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // LocalStorage unavailable
  }
}

/**
 * Custom error class for API failures
 */
export class ApiError extends Error {
  statusCode: number;
  data?: unknown;

  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Base fetch helper with automatic auth header injection and 401 interception.
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getStoredToken();
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (!(options?.body instanceof FormData)) {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized globally
    if (response.status === 401) {
      removeStoredToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
      }
      const errorJson = await response.json().catch(() => ({}));
      throw new ApiError(
        errorJson.error || errorJson.message || 'Session expired. Please log in again.',
        401
      );
    }

    const json = (await response.json().catch(() => ({}))) as ApiResponse<T>;

    if (!response.ok || json.success === false) {
      const errorMessage =
        json.error || json.message || `Request failed with status ${response.status}`;
      throw new ApiError(errorMessage, response.status, json.data);
    }

    return (json.data !== undefined ? json.data : (json as unknown as T)) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiError(message, 0);
  }
}

/**
 * Authentication API Service
 */
export const authApi = {
  /**
   * Log in user with credentials and store token
   */
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await fetchApi<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data?.token) {
      setStoredToken(data.token);
    }

    return data;
  },

  /**
   * Retrieve current authenticated user profile
   */
  async getMe(): Promise<User> {
    const data = await fetchApi<{ user: User }>('/auth/me');
    return data.user;
  },

  /**
   * Clear local session
   */
  logout(): void {
    removeStoredToken();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
    }
  },
};

/**
 * Issue Query Options
 */
export interface IssueQueryParams {
  status?: string;
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Issues API Service
 */
export const issuesApi = {
  /**
   * List issues with role-scoping and query filters
   */
  async list(params?: IssueQueryParams): Promise<IssueListResult> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.categoryId && params.categoryId !== 'ALL') query.set('categoryId', params.categoryId);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.sort) query.set('sort', params.sort);
    if (params?.order) query.set('order', params.order);

    const queryString = query.toString();
    const endpoint = `/issues${queryString ? `?${queryString}` : ''}`;
    return fetchApi<IssueListResult>(endpoint);
  },

  /**
   * Retrieve single issue details
   */
  async getById(issueId: string): Promise<Issue> {
    return fetchApi<Issue>(`/issues/${issueId}`);
  },

  /**
   * Retrieve status transition history for an issue
   */
  async getStatusHistory(issueId: string): Promise<IssueStatusHistory[]> {
    return fetchApi<IssueStatusHistory[]>(`/issues/${issueId}/status-history`);
  },

  /**
   * Retrieve comments for an issue (backend filters internal comments for USER role)
   */
  async getComments(issueId: string): Promise<IssueComment[]> {
    return fetchApi<IssueComment[]>(`/issues/${issueId}/comments`);
  },

  /**
   * Post a public comment on an issue
   */
  async addComment(issueId: string, commentText: string): Promise<IssueComment> {
    return fetchApi<IssueComment>(`/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ commentText }),
    });
  },

  /**
   * Retrieve image attachments with signed preview URLs
   */
  async getImages(issueId: string): Promise<IssueImage[]> {
    return fetchApi<IssueImage[]>(`/issues/${issueId}/images`);
  },

  /**
   * Retrieve a fresh 15-minute signed preview URL for an image
   */
  async getImageSignedUrl(
    issueId: string,
    imageId: string
  ): Promise<{ signedUrl: string; expiresIn: number }> {
    return fetchApi<{ signedUrl: string; expiresIn: number }>(
      `/issues/${issueId}/images/${imageId}/url`
    );
  },
};

/**
 * Issue Categories API Service
 */
export const categoriesApi = {
  /**
   * List all active categories
   */
  async list(): Promise<IssueCategory[]> {
    return fetchApi<IssueCategory[]>('/issue-categories');
  },
};
