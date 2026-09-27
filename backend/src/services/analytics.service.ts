import { Prisma, UserRole, IssuePriority, IssueStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AnalyticsQueryInput } from '../validators/analytics.validator.js';
import { ServiceResult } from './auth.service.js';
import {
  getUserOrganizationMembership,
  getUserDepartmentMembership,
} from './rbac.service.js';
import { getOrganizationDashboardData, listIssues } from './issue.service.js';

const hasDbUrl = (): boolean => Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');
const SEEDED_ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const SEEDED_MANAGER_DEPT = 'b0000000-0000-0000-0000-000000000001';
const SEEDED_STAFF_DEPT = 'b0000000-0000-0000-0000-000000000002';
const SEEDED_CATEGORY_IDS = new Set([
  'c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000004',
  'c0000000-0000-0000-0000-000000000005',
  'c0000000-0000-0000-0000-000000000006',
  'c0000000-0000-0000-0000-000000000007',
]);

const STATUS_LABELS: Record<IssueStatus, string> = {
  REPORTED: 'Reported',
  UNDER_REVIEW: 'Under Review',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const PRIORITY_LABELS: Record<IssuePriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

interface AnalyticsPoint {
  label: string;
  value: number;
}

export interface OrganizationAnalyticsData {
  organization: { id: string; name: string };
  filters: {
    timeRange: AnalyticsQueryInput['timeRange'];
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

interface OrganizationContext {
  id: string;
  name: string;
  scopeDepartmentIds: string[];
}

function asCount(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  return Number(value || 0);
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getStartDate(timeRange: AnalyticsQueryInput['timeRange']): Date | null {
  if (timeRange === 'all') return null;
  const days = Number(timeRange);
  const start = startOfUtcDay(new Date());
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

function formatDay(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function emptyStatusCounts(): Record<IssueStatus, number> {
  return {
    REPORTED: 0,
    UNDER_REVIEW: 0,
    ASSIGNED: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CLOSED: 0,
  };
}

function emptyPriorityCounts(): Record<IssuePriority, number> {
  return { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
}

async function resolveOrganization(
  actorId: string,
  actorRole: UserRole,
  db = prisma
): Promise<ServiceResult<OrganizationContext>> {
  if (actorRole === UserRole.USER) {
    return { success: false, error: 'Forbidden: Citizen accounts cannot access organization analytics.', statusCode: 403 };
  }

  let organization: { id: string; name: string } | null = null;
  if (hasDbUrl()) {
    try {
      if (actorRole === UserRole.PLATFORM_ADMIN) {
        organization = await db.organization.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true },
        });
      } else {
        const membership = await db.organizationMember.findFirst({
          where: { userId: actorId, isActive: true, organization: { isActive: true } },
          include: { organization: { select: { id: true, name: true } } },
        });
        if (membership) organization = membership.organization;
      }
    } catch {
      // Fall through to the deterministic seeded registry when the database is offline.
    }
  }

  if (!organization) {
    if (actorRole === UserRole.PLATFORM_ADMIN) {
      organization = { id: SEEDED_ORG_ID, name: 'SRM Campus Administration' };
    } else {
      const membership = await getUserOrganizationMembership(actorId, SEEDED_ORG_ID, db);
      if (membership) organization = { id: SEEDED_ORG_ID, name: 'SRM Campus Administration' };
    }
  }

  if (!organization) {
    return { success: false, error: 'Forbidden: You do not have an active organization membership.', statusCode: 403 };
  }

  let scopeDepartmentIds: string[] = [];
  if (actorRole === UserRole.MANAGER || actorRole === UserRole.STAFF) {
    if (hasDbUrl()) {
      try {
        const memberships = await db.departmentMember.findMany({
          where: {
            userId: actorId,
            isActive: true,
            department: { organizationId: organization.id, isActive: true },
          },
          select: { departmentId: true },
        });
        scopeDepartmentIds = memberships.map((membership) => membership.departmentId);
      } catch {
        // Use the seeded fallback below.
      }
    }

    if (scopeDepartmentIds.length === 0) {
      const fallbackDepartment = actorRole === UserRole.MANAGER ? SEEDED_MANAGER_DEPT : SEEDED_STAFF_DEPT;
      const membership = await getUserDepartmentMembership(actorId, fallbackDepartment, db);
      if (membership) scopeDepartmentIds = [fallbackDepartment];
    }
  }

  return { success: true, data: { ...organization, scopeDepartmentIds }, statusCode: 200 };
}

function roleScopeSql(actorRole: UserRole, actorId: string, departmentIds: string[]): Prisma.Sql | null {
  if (actorRole === UserRole.MANAGER) {
    if (departmentIds.length === 0) return Prisma.sql`FALSE`;
    return Prisma.sql`EXISTS (
      SELECT 1 FROM issue_assignments scope_assignment
      WHERE scope_assignment.issue_id = i.id
        AND scope_assignment.is_active = true
        AND scope_assignment.department_id IN (${Prisma.join(departmentIds)})
    )`;
  }
  if (actorRole === UserRole.STAFF) {
    if (departmentIds.length === 0) {
      return Prisma.sql`EXISTS (
        SELECT 1 FROM issue_assignments scope_assignment
        WHERE scope_assignment.issue_id = i.id
          AND scope_assignment.is_active = true
          AND scope_assignment.assigned_user_id = ${actorId}
      )`;
    }
    return Prisma.sql`EXISTS (
      SELECT 1 FROM issue_assignments scope_assignment
      WHERE scope_assignment.issue_id = i.id
        AND scope_assignment.is_active = true
        AND (scope_assignment.department_id IN (${Prisma.join(departmentIds)})
          OR scope_assignment.assigned_user_id = ${actorId})
    )`;
  }
  return null;
}

function toPoints(counts: Record<string, number>, labels?: Record<string, string>): AnalyticsPoint[] {
  return Object.entries(counts).map(([key, value]) => ({ label: labels?.[key] || key, value }));
}

function issueCreatedAt(issue: any): Date | null {
  const value = issue?.createdAt;
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildFallbackAnalytics(
  context: OrganizationContext,
  filters: AnalyticsQueryInput,
  startDate: Date | null,
  dashboardData: any,
  issues: any[]
): OrganizationAnalyticsData {
  const statusCounts = emptyStatusCounts();
  const priorityCounts = emptyPriorityCounts();
  const categoryCounts: Record<string, number> = {};
  const departmentCounts: Record<string, number> = {};
  const departmentNames = new Map<string, string>(
    (dashboardData?.departments || []).map((department: any) => [department.id, department.name])
  );
  const trendCounts: Record<string, number> = {};
  let resolvedCount = 0;
  let closedCount = 0;
  let resolutionSamples = 0;
  let resolutionHours = 0;

  for (const issue of issues) {
    const createdAt = issueCreatedAt(issue);
    if (!createdAt || (startDate && createdAt < startDate)) continue;
    statusCounts[issue.status as IssueStatus] = (statusCounts[issue.status as IssueStatus] || 0) + 1;
    priorityCounts[issue.priority as IssuePriority] = (priorityCounts[issue.priority as IssuePriority] || 0) + 1;
    const categoryName = issue.category?.name || 'Uncategorized';
    categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
    const day = createdAt.toISOString().slice(0, 10);
    trendCounts[day] = (trendCounts[day] || 0) + 1;

    const assignments = (issue.assignments || []).filter((assignment: any) => assignment.isActive !== false);
    const departmentIds = new Set<string>();
    assignments.forEach((assignment: any) => {
      if (assignment.departmentId) departmentIds.add(assignment.departmentId);
    });
    if (departmentIds.size === 0) departmentCounts.Unassigned = (departmentCounts.Unassigned || 0) + 1;
    departmentIds.forEach((departmentId) => {
      const name = departmentNames.get(departmentId) || departmentId;
      departmentCounts[name] = (departmentCounts[name] || 0) + 1;
    });

    if (issue.resolvedAt) {
      resolvedCount += 1;
      const resolvedAt = new Date(issue.resolvedAt);
      if (!Number.isNaN(resolvedAt.getTime())) {
        resolutionHours += (resolvedAt.getTime() - createdAt.getTime()) / 3600000;
        resolutionSamples += 1;
      }
    }
    if (issue.closedAt) closedCount += 1;
  }

  const totalIssues = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
  const openIssues = totalIssues - statusCounts.RESOLVED - statusCounts.CLOSED;
  return {
    organization: { id: context.id, name: context.name },
    filters: {
      timeRange: filters.timeRange,
      departmentId: filters.departmentId || null,
      categoryId: filters.categoryId || null,
      startDate: startDate?.toISOString() || null,
      timezone: 'UTC',
    },
    summary: {
      totalIssues,
      openIssues,
      inProgress: statusCounts.IN_PROGRESS,
      resolved: statusCounts.RESOLVED,
      closed: statusCounts.CLOSED,
    },
    byStatus: toPoints(statusCounts, STATUS_LABELS),
    byCategory: Object.entries(categoryCounts).map(([label, value]) => ({ label, value })),
    byDepartment: Object.entries(departmentCounts).map(([label, value]) => ({ label, value })),
    byPriority: toPoints(priorityCounts, PRIORITY_LABELS),
    trend: Object.entries(trendCounts).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value })),
    resolution: {
      resolvedCount,
      closedCount,
      averageResolutionHours: resolutionSamples ? round(resolutionHours / resolutionSamples) : null,
      resolutionRate: totalIssues ? round((resolvedCount / totalIssues) * 100) : null,
      averageSampleSize: resolutionSamples,
    },
  };
}

export async function getOrganizationAnalytics(
  actorId: string,
  actorRole: UserRole,
  filters: AnalyticsQueryInput,
  db = prisma
): Promise<ServiceResult<OrganizationAnalyticsData>> {
  const contextResult = await resolveOrganization(actorId, actorRole, db);
  if (!contextResult.success || !contextResult.data) {
    return {
      success: false,
      error: contextResult.error || 'Unable to resolve organization context.',
      statusCode: contextResult.statusCode || 403,
    };
  }
  const context = contextResult.data;
  const startDate = getStartDate(filters.timeRange);

  if (filters.departmentId) {
    if ((actorRole === UserRole.MANAGER || actorRole === UserRole.STAFF) && !context.scopeDepartmentIds.includes(filters.departmentId)) {
      return { success: false, error: 'Forbidden: Department analytics are outside your operational scope.', statusCode: 403 };
    }
    if (hasDbUrl()) {
      const department = await db.department.findFirst({ where: { id: filters.departmentId, organizationId: context.id }, select: { id: true } });
      if (!department) return { success: false, error: 'Department not found in this organization.', statusCode: 404 };
    } else if (![SEEDED_MANAGER_DEPT, SEEDED_STAFF_DEPT].includes(filters.departmentId)) {
      return { success: false, error: 'Department not found in this organization.', statusCode: 404 };
    }
  }

  if (hasDbUrl() && filters.categoryId) {
    const category = await db.issueCategory.findFirst({
      where: { id: filters.categoryId, OR: [{ organizationId: context.id }, { organizationId: null }] },
      select: { id: true },
    });
    if (!category) return { success: false, error: 'Category not found in this organization.', statusCode: 404 };
  } else if (!hasDbUrl() && filters.categoryId && !SEEDED_CATEGORY_IDS.has(filters.categoryId)) {
    return { success: false, error: 'Category not found in this organization.', statusCode: 404 };
  }

  const dashboardResult = await getOrganizationDashboardData(actorId, actorRole, context.id, db);
  const dashboardData = dashboardResult.data;

  if (!hasDbUrl()) {
    const issueResult = await listIssues(actorId, actorRole, {
      organizationId: context.id,
      categoryId: filters.categoryId,
      departmentId: filters.departmentId,
      page: 1,
      limit: 100,
      sort: 'createdAt',
      order: 'asc',
    }, db);
    const issues = issueResult.success ? ((issueResult.data as any)?.issues || []) : [];
    return {
      success: true,
      data: buildFallbackAnalytics(context, filters, startDate, dashboardData, issues),
      statusCode: 200,
    };
  }

  try {
    const where: any = { organizationId: context.id };
    if (startDate) where.createdAt = { gte: startDate };
    if (filters.categoryId) where.categoryId = filters.categoryId;

    if (filters.departmentId) {
      where.assignments = { some: { isActive: true, departmentId: filters.departmentId } };
    } else if (actorRole === UserRole.MANAGER) {
      where.assignments = { some: { isActive: true, departmentId: { in: context.scopeDepartmentIds } } };
    } else if (actorRole === UserRole.STAFF) {
      where.assignments = {
        some: {
          isActive: true,
          OR: [
            { departmentId: { in: context.scopeDepartmentIds } },
            { assignedUserId: actorId },
          ],
        },
      };
    }

    const [totalIssues, statuses, priorities, categories] = await Promise.all([
      db.issue.count({ where }),
      db.issue.groupBy({ by: ['status'], where, _count: { _all: true } }),
      db.issue.groupBy({ by: ['priority'], where, _count: { _all: true } }),
      db.issue.groupBy({ by: ['categoryId'], where, _count: { _all: true } }),
    ]);
    const statusCounts = emptyStatusCounts();
    statuses.forEach((item) => { statusCounts[item.status] = item._count._all; });
    const priorityCounts = emptyPriorityCounts();
    priorities.forEach((item) => { priorityCounts[item.priority] = item._count._all; });

    const categoryRows = await db.issueCategory.findMany({
      where: { id: { in: categories.map((category) => category.categoryId) } },
      select: { id: true, name: true },
    });
    const categoryNames = new Map(categoryRows.map((category) => [category.id, category.name]));
    const byCategory = categories.map((category) => ({ label: categoryNames.get(category.categoryId) || 'Uncategorized', value: category._count._all }));

    const sqlFilters: Prisma.Sql[] = [Prisma.sql`i.organization_id = ${context.id}`];
    if (startDate) sqlFilters.push(Prisma.sql`i.created_at >= ${startDate}`);
    if (filters.categoryId) sqlFilters.push(Prisma.sql`i.category_id = ${filters.categoryId}`);
    if (filters.departmentId) sqlFilters.push(Prisma.sql`EXISTS (SELECT 1 FROM issue_assignments filter_assignment WHERE filter_assignment.issue_id = i.id AND filter_assignment.is_active = true AND filter_assignment.department_id = ${filters.departmentId})`);
    const scopeClause = roleScopeSql(actorRole, actorId, context.scopeDepartmentIds);
    if (scopeClause) sqlFilters.push(scopeClause);
    const whereSql = Prisma.join(sqlFilters, ' AND ');

    const [departmentRows, trendRows, resolutionRows] = await Promise.all([
      db.$queryRaw<Array<{ department_id: string | null; issue_count: bigint | number }>>(Prisma.sql`
        SELECT ia.department_id, COUNT(DISTINCT i.id)::int AS issue_count
        FROM issues i
        LEFT JOIN issue_assignments ia ON ia.issue_id = i.id AND ia.is_active = true
        WHERE ${whereSql}
        GROUP BY ia.department_id
        ORDER BY issue_count DESC
      `),
      db.$queryRaw<Array<{ day: Date; issue_count: bigint | number }>>(Prisma.sql`
        SELECT DATE_TRUNC('day', i.created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS issue_count
        FROM issues i
        WHERE ${whereSql}
        GROUP BY day
        ORDER BY day ASC
      `),
      db.$queryRaw<Array<{ resolved_count: bigint | number; closed_count: bigint | number; average_hours: number | null; sample_size: bigint | number }>>(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE i.resolved_at IS NOT NULL)::int AS resolved_count,
          COUNT(*) FILTER (WHERE i.closed_at IS NOT NULL)::int AS closed_count,
          AVG(EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600) FILTER (WHERE i.resolved_at IS NOT NULL) AS average_hours,
          COUNT(*) FILTER (WHERE i.resolved_at IS NOT NULL)::int AS sample_size
        FROM issues i
        WHERE ${whereSql}
      `),
    ]);
    const departmentIds = departmentRows.map((row) => row.department_id).filter((id): id is string => Boolean(id));
    const departments = await db.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } });
    const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
    const byDepartment = departmentRows.map((row) => ({ label: row.department_id ? departmentNames.get(row.department_id) || 'Unknown department' : 'Unassigned', value: asCount(row.issue_count) }));
    const resolution = resolutionRows[0];
    const resolvedCount = asCount(resolution?.resolved_count);
    const closedCount = asCount(resolution?.closed_count);
    const openIssues = totalIssues - statusCounts.RESOLVED - statusCounts.CLOSED;

    return {
      success: true,
      data: {
        organization: { id: context.id, name: context.name },
        filters: { timeRange: filters.timeRange, departmentId: filters.departmentId || null, categoryId: filters.categoryId || null, startDate: startDate?.toISOString() || null, timezone: 'UTC' },
        summary: { totalIssues, openIssues, inProgress: statusCounts.IN_PROGRESS, resolved: statusCounts.RESOLVED, closed: statusCounts.CLOSED },
        byStatus: toPoints(statusCounts, STATUS_LABELS),
        byCategory,
        byDepartment,
        byPriority: toPoints(priorityCounts, PRIORITY_LABELS),
        trend: trendRows.map((row) => ({ label: formatDay(row.day), value: asCount(row.issue_count) })),
        resolution: {
          resolvedCount,
          closedCount,
          averageResolutionHours: resolution?.average_hours == null ? null : round(Number(resolution.average_hours)),
          resolutionRate: totalIssues ? round((resolvedCount / totalIssues) * 100) : null,
          averageSampleSize: asCount(resolution?.sample_size),
        },
      },
      statusCode: 200,
    };
  } catch {
    return { success: false, error: 'Unable to calculate organization analytics.', statusCode: 500 };
  }
}
