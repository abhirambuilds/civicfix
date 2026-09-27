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

export type AiAnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IssueIntelligence {
  normalizedTitle: string;
  summary: string;
  severity: IssuePriority;
  urgency: IssuePriority;
  impact: IssuePriority;
  issueType: string;
  keywords: string[];
  suggestedPriority: IssuePriority;
  recommendedAction: string;
  confidence: number;
  descriptionSufficient: boolean;
  clarificationQuestion: string | null;
}

export interface IssueAiAnalysis {
  id: string;
  issueId: string;
  agentType: 'ISSUE_INTELLIGENCE';
  status: AiAnalysisStatus;
  modelProvider: string | null;
  modelName: string | null;
  confidence: number | null;
  structuredResult: IssueIntelligence | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface IssueAiAnalysisResponse {
  analysis: IssueAiAnalysis | null;
}

export interface SmartRoutingRecommendation {
  departmentId: string;
  departmentName: string;
  confidence: number;
  reason: string;
  signals: string[];
}

export interface IssueAiRouting {
  id: string;
  issueId: string;
  agentType: 'SMART_ROUTING';
  status: AiAnalysisStatus;
  modelProvider: string | null;
  modelName: string | null;
  confidence: number | null;
  recommendation: SmartRoutingRecommendation | null;
  source: 'AI' | 'DETERMINISTIC_FALLBACK' | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface IssueAiRoutingResponse {
  analysis: IssueAiRouting | null;
}

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

export interface OrganizationDepartmentSummary {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  activeIssueCount: number;
  memberCount: number;
}

export interface OrganizationDashboardData {
  organization: {
    id: string;
    name: string;
    slug: string;
    orgType: string;
    description: string | null;
  };
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    orgRole: string;
  };
  summary: {
    totalIssues: number;
    reported: number;
    inProgress: number;
    resolved: number;
    statusBreakdown: Record<IssueStatus, number>;
  };
  recentIssues: Issue[];
  departments: OrganizationDepartmentSummary[];
}

export interface DepartmentMemberSummary {
  id: string;
  departmentId: string;
  userId: string;
  roleInDepartment: string;
  isActive: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  };
}

/**
 * Organization membership roles are intentionally separate from global user roles.
 * The backend authorizes both records independently.
 */
export type OrganizationMemberRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'MEMBER';

export interface ManagedDepartment {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    members: number;
  };
}

export interface OrganizationMemberSummary {
  id: string;
  organizationId: string;
  userId: string;
  orgRole: OrganizationMemberRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
  };
}

export type AnalyticsTimeRange = '7' | '30' | '90' | 'all';

export interface AnalyticsPoint {
  label: string;
  value: number;
}

export interface OrganizationAnalyticsData {
  organization: {
    id: string;
    name: string;
  };
  filters: {
    timeRange: AnalyticsTimeRange;
    departmentId: string | null;
    categoryId: string | null;
    startDate: string | null;
    timezone: 'UTC';
  };
  summary: {
    totalIssues: number;
    openIssues: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
  byStatus: AnalyticsPoint[];
  byCategory: AnalyticsPoint[];
  byDepartment: AnalyticsPoint[];
  byPriority: AnalyticsPoint[];
  trend: AnalyticsPoint[];
  resolution: {
    resolvedCount: number;
    closedCount: number;
    averageResolutionHours: number | null;
    resolutionRate: number | null;
    averageSampleSize: number;
  };
}
