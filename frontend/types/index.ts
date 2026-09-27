/**
 * CivicFix - Shared Frontend Type Definitions
 * Complete type definitions for user authentication, issues, status lifecycle,
 * location, comments, assignments, and API responses.
 */

export type UserRole =
  | 'PLATFORM_ADMIN'
  | 'ORG_OWNER'
  | 'ORG_ADMIN'
  | 'MANAGER'
  | 'STAFF'
  | 'USER';

export type IssueStatus =
  | 'REPORTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
}

export interface IssueCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  defaultPriority?: IssuePriority;
  isActive?: boolean;
}

export interface IssueLocation {
  id?: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  landmark?: string | null;
}

export interface IssueOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface IssueImage {
  id: string;
  issueId?: string;
  storagePath: string;
  fileName?: string | null;
  mimeType: string;
  fileSize: number;
  isPrimary: boolean;
  createdAt: string;
  signedUrl?: string;
}

export interface IssueStatusHistory {
  id: string;
  issueId?: string;
  previousStatus: IssueStatus | null;
  newStatus: IssueStatus;
  remark?: string | null;
  createdAt: string;
  changedById?: string;
  changedBy?: {
    id: string;
    name: string;
    role: UserRole;
  } | null;
}

export interface IssueComment {
  id: string;
  issueId: string;
  authorId: string;
  commentText: string;
  isInternal: boolean;
  createdAt: string;
  author?: {
    id: string;
    name: string;
    role: UserRole;
  } | null;
}

export interface IssueAssignment {
  id: string;
  departmentId: string;
  assignedUserId?: string | null;
  notes?: string | null;
  isActive?: boolean;
  createdAt?: string;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  assignedUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface Issue {
  id: string;
  issueNumber: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  categoryId: string;
  organizationId: string;
  reporterId: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: IssueCategory | null;
  organization?: IssueOrganization | null;
  location?: IssueLocation | null;
  reporter?: {
    id: string;
    name: string;
    email: string;
    role?: UserRole;
  } | null;
  images?: IssueImage[];
  assignments?: IssueAssignment[];
  statusHistory?: IssueStatusHistory[];
  comments?: IssueComment[];
  _count?: {
    images?: number;
    comments?: number;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IssueListResult {
  issues: Issue[];
  pagination: PaginationMeta;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface HealthCheckData {
  status: 'healthy' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
}
