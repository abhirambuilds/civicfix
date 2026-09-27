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
  IssueAssignment,
  IssueStatus,
  IssuePriority,
  DepartmentMemberSummary,
  User,
  OrganizationDashboardData,
  OrganizationDepartmentSummary,
  ManagedDepartment,
  OrganizationMemberSummary,
  OrganizationMemberRole,
  AnalyticsTimeRange,
  OrganizationAnalyticsData,
  IssueAiAnalysisResponse,
  IssueAiRoutingResponse,
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
  priority?: string;
  departmentId?: string;
  organizationId?: string;
}

/**
 * Payload for reporting a new civic issue
 */
export interface CreateIssueInput {
  title: string;
  description: string;
  categoryId: string;
  latitude: number;
  longitude: number;
  locationLabel?: string | null;
  address?: string | null;
  landmark?: string | null;
}

/**
 * Issues API Service
 */
export const issuesApi = {
  /**
   * Report/create a new civic issue
   */
  async create(input: CreateIssueInput): Promise<Issue> {
    return fetchApi<Issue>('/issues', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Upload an image attachment to an issue (multipart/form-data, field: "image")
   */
  async uploadImage(
    issueId: string,
    file: File,
    isPrimary: boolean = false
  ): Promise<IssueImage> {
    const formData = new FormData();
    formData.append('image', file);
    if (isPrimary) {
      formData.append('isPrimary', 'true');
    }
    return fetchApi<IssueImage>(`/issues/${issueId}/images`, {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * List issues with role-scoping and query filters
   */
  async list(params?: IssueQueryParams): Promise<IssueListResult> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.categoryId && params.categoryId !== 'ALL') query.set('categoryId', params.categoryId);
    if (params?.priority && params.priority !== 'ALL') query.set('priority', params.priority);
    if (params?.departmentId && params.departmentId !== 'ALL') query.set('departmentId', params.departmentId);
    if (params?.organizationId) query.set('organizationId', params.organizationId);
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
   * Retrieve the latest safe Issue Intelligence result.
   */
  async getAiAnalysis(issueId: string): Promise<IssueAiAnalysisResponse> {
    return fetchApi<IssueAiAnalysisResponse>(`/issues/${issueId}/ai-analysis`);
  },

  /**
   * Retrieve the latest validated Smart Routing recommendation.
   */
  async getAiRouting(issueId: string): Promise<IssueAiRoutingResponse> {
    return fetchApi<IssueAiRoutingResponse>(`/issues/${issueId}/ai-routing`);
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

  /**
   * Update issue status according to backend state machine
   */
  async updateStatus(
    issueId: string,
    status: IssueStatus,
    remark?: string
  ): Promise<Issue> {
    return fetchApi<Issue>(`/issues/${issueId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, remark }),
    });
  },

  /**
   * Assign or reassign issue to department and optional staff technician
   */
  async assign(
    issueId: string,
    departmentId: string,
    userId?: string | null,
    notes?: string | null
  ): Promise<IssueAssignment> {
    return fetchApi<IssueAssignment>(`/issues/${issueId}/assign`, {
      method: 'POST',
      body: JSON.stringify({
        departmentId,
        userId: userId || undefined,
        notes: notes || undefined,
      }),
    });
  },

  /**
   * Update issue priority
   */
  async updatePriority(
    issueId: string,
    priority: IssuePriority,
    remark?: string
  ): Promise<Issue> {
    return fetchApi<Issue>(`/issues/${issueId}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ priority, remark }),
    });
  },

  /**
   * Mark an issue as resolved with resolution details
   */
  async resolve(issueId: string, remark: string): Promise<Issue> {
    return fetchApi<Issue>(`/issues/${issueId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ remark }),
    });
  },

  /**
   * Add an internal operational remark or public comment
   */
  async addRemark(
    issueId: string,
    commentText: string,
    isInternal: boolean = true
  ): Promise<IssueComment> {
    return fetchApi<IssueComment>(`/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ commentText, isInternal }),
    });
  },

  /**
   * Retrieve active and historical assignments for an issue
   */
  async getAssignments(issueId: string): Promise<IssueAssignment[]> {
    return fetchApi<IssueAssignment[]>(`/issues/${issueId}/assignments`);
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

/**
 * Organizations API Service
 */
export const organizationsApi = {
  /**
   * Retrieve organization dashboard summary for the authenticated staff user
   */
  async getDashboard(organizationId?: string): Promise<OrganizationDashboardData> {
    const endpoint = organizationId
      ? `/organizations/${organizationId}/dashboard`
      : '/organizations/me/dashboard';
    return fetchApi<OrganizationDashboardData>(endpoint);
  },

  /**
   * Retrieve active departments for the authenticated user's organization
   */
  async getDepartments(): Promise<{ departments: OrganizationDepartmentSummary[] }> {
    return fetchApi<{ departments: OrganizationDepartmentSummary[] }>('/organizations/me/departments');
  },

  /** Retrieve server-aggregated analytics for the authenticated organization. */
  async getAnalytics(params?: {
    timeRange?: AnalyticsTimeRange;
    departmentId?: string;
    categoryId?: string;
  }): Promise<OrganizationAnalyticsData> {
    const query = new URLSearchParams();
    if (params?.timeRange) query.set('timeRange', params.timeRange);
    if (params?.departmentId) query.set('departmentId', params.departmentId);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    const queryString = query.toString();
    return fetchApi<OrganizationAnalyticsData>(
      `/organizations/me/analytics${queryString ? `?${queryString}` : ''}`
    );
  },

  /**
   * Retrieve active staff members for a specific department
   */
  async getDepartmentMembers(
    departmentId: string
  ): Promise<{ members: DepartmentMemberSummary[] }> {
    return fetchApi<{ members: DepartmentMemberSummary[] }>(
      `/organizations/me/departments/${departmentId}/members`
    );
  },

  /**
   * Management endpoints retain the organization path parameter required by the
   * established REST API. The server validates that ID against the authenticated
   * organization membership on every request; callers never submit it in a form.
   */
  async listManagedDepartments(
    organizationId: string
  ): Promise<{ departments: ManagedDepartment[] }> {
    return fetchApi<{ departments: ManagedDepartment[] }>(
      `/organizations/${organizationId}/departments`
    );
  },

  async getManagedDepartment(
    organizationId: string,
    departmentId: string
  ): Promise<{ department: ManagedDepartment }> {
    return fetchApi<{ department: ManagedDepartment }>(
      `/organizations/${organizationId}/departments/${departmentId}`
    );
  },

  async createDepartment(
    organizationId: string,
    input: { name: string; description?: string | null; code?: string | null }
  ): Promise<ManagedDepartment> {
    return fetchApi<ManagedDepartment>(`/organizations/${organizationId}/departments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateDepartment(
    organizationId: string,
    departmentId: string,
    input: { name?: string; description?: string | null; code?: string | null }
  ): Promise<{ department: ManagedDepartment }> {
    return fetchApi<{ department: ManagedDepartment }>(
      `/organizations/${organizationId}/departments/${departmentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    );
  },

  async updateDepartmentStatus(
    organizationId: string,
    departmentId: string,
    isActive: boolean
  ): Promise<{ department: ManagedDepartment }> {
    return fetchApi<{ department: ManagedDepartment }>(
      `/organizations/${organizationId}/departments/${departmentId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }
    );
  },

  async listOrganizationMembers(
    organizationId: string
  ): Promise<{ members: OrganizationMemberSummary[] }> {
    return fetchApi<{ members: OrganizationMemberSummary[] }>(
      `/organizations/${organizationId}/members`
    );
  },

  async updateOrganizationMember(
    organizationId: string,
    userId: string,
    input: { role?: OrganizationMemberRole; isActive?: boolean }
  ): Promise<{ member: OrganizationMemberSummary }> {
    return fetchApi<{ member: OrganizationMemberSummary }>(
      `/organizations/${organizationId}/members/${userId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    );
  },

  async listManagedDepartmentMembers(
    organizationId: string,
    departmentId: string
  ): Promise<{ members: DepartmentMemberSummary[] }> {
    return fetchApi<{ members: DepartmentMemberSummary[] }>(
      `/organizations/${organizationId}/departments/${departmentId}/members`
    );
  },

  async addDepartmentMember(
    organizationId: string,
    departmentId: string,
    input: { userId: string; roleInDepartment: 'MANAGER' | 'STAFF' }
  ): Promise<{ member: DepartmentMemberSummary }> {
    return fetchApi<{ member: DepartmentMemberSummary }>(
      `/organizations/${organizationId}/departments/${departmentId}/members`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  async updateDepartmentMember(
    organizationId: string,
    departmentId: string,
    userId: string,
    input: { roleInDepartment?: 'MANAGER' | 'STAFF'; isActive?: boolean }
  ): Promise<{ member: DepartmentMemberSummary }> {
    return fetchApi<{ member: DepartmentMemberSummary }>(
      `/organizations/${organizationId}/departments/${departmentId}/members/${userId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    );
  },

  async removeDepartmentMember(
    organizationId: string,
    departmentId: string,
    userId: string
  ): Promise<void> {
    return fetchApi<void>(
      `/organizations/${organizationId}/departments/${departmentId}/members/${userId}`,
      { method: 'DELETE' }
    );
  },
};
