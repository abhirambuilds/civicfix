/**
 * CivicFix - Shared Frontend Type Definitions
 * Foundation types for issue reporting, multi-organization architecture, and API responses.
 */

export type Role = 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'STAFF' | 'CITIZEN';

export type IssueStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED';

export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface HealthCheckData {
  status: 'healthy' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
}
