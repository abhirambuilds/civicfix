'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { organizationsApi, ApiError } from '@/lib/api';
import { OrganizationDashboardData } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton';
import {
  IconBuilding,
  IconUsers,
  IconShield,
  IconLayers,
  IconFileText,
  IconCheckCircle,
  IconClock,
  IconAlertCircle,
  IconRefresh,
  IconChevronRight,
  IconLogOut,
  IconArrowRight,
  IconSparkles,
  IconTag,
  IconMapPin,
  IconCalendar,
} from '@/components/ui/Icons';

function formatRoleLabel(role?: string): string {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return 'Platform Superadmin';
    case 'ORG_OWNER':
      return 'Organization Owner';
    case 'ORG_ADMIN':
      return 'Organization Admin';
    case 'MANAGER':
      return 'Department Manager';
    case 'STAFF':
      return 'Field Technician / Staff';
    default:
      return role || 'Staff Official';
  }
}

export default function OrgDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();

  const [dashboardData, setDashboardData] = useState<OrganizationDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await organizationsApi.getDashboard();
      setDashboardData(data);
      setError(null);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Unable to refresh organization dashboard.';
      setError(msg);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (user?.role === 'USER') return;

      try {
        const data = await organizationsApi.getDashboard();
        if (isMounted) {
          setDashboardData(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
              ? err.message
              : 'Unable to load organization dashboard.';
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (isAuthenticated) {
      fetchData();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.role]);

  // 1. Strict RBAC Guard: Citizen account access denied
  if (user?.role === 'USER') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-2xl text-center space-y-5 animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-md">
            <IconShield size={28} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Organization Staff Access Required
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              The Organization Dashboard is the operational control center for campus facility managers, department heads, and maintenance technicians.
            </p>
            <p className="text-xs text-slate-400">
              Your account currently has <strong className="text-slate-200">Citizen / Student</strong> permissions. Please use the citizen dashboard to submit and track your reports.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-colors"
            >
              <span>Go to Citizen Dashboard</span>
              <IconArrowRight size={14} />
            </Link>
            <button
              onClick={logout}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <IconLogOut size={14} />
              <span>Switch Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Loading state while verifying auth session or fetching initial metrics
  if (isAuthLoading || (isLoading && !dashboardData && !error)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // 3. Error State
  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-2xl border border-rose-900/60 bg-rose-950/20 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-900/30 text-rose-400 flex items-center justify-center mx-auto">
            <IconAlertCircle size={24} />
          </div>
          <h3 className="text-base font-bold text-white">Unable to Load Dashboard</h3>
          <p className="text-xs text-slate-300">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const { organization, summary, recentIssues, departments, currentUser } = dashboardData;
  const statusBreakdown = summary.statusBreakdown || {
    REPORTED: 0,
    UNDER_REVIEW: 0,
    ASSIGNED: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CLOSED: 0,
  };

  const totalCalculated = Math.max(summary.totalIssues, 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-8 sm:py-8 space-y-8 animate-in fade-in duration-200">
        {/* Dashboard Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold tracking-tight text-white flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow">
                  CF
                </span>
                <span>CivicFix</span>
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-indigo-400 font-semibold tracking-wide uppercase text-[11px] flex items-center gap-1">
                <IconBuilding size={13} />
                <span>{organization.name}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Organization Operations
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                <IconShield size={12} />
                <span>{formatRoleLabel(currentUser.role)}</span>
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Operational control center for campus facilities management, service dispatch, and issue resolution.
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh dashboard metrics"
              aria-label="Refresh dashboard metrics"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors"
            >
              <IconRefresh size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
            </button>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors"
            >
              <span>Citizen View</span>
              <IconArrowRight size={13} />
            </Link>

            <button
              onClick={logout}
              title="Sign Out of CivicFix"
              aria-label="Sign Out"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-rose-950/40 hover:border-rose-800/60 text-slate-300 hover:text-rose-300 text-xs font-medium transition-colors"
            >
              <IconLogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Section 1: Overview Summary Cards (Database Computed) */}
        <section aria-label="Organization Metrics Overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Issues */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Total Organization Issues</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <IconFileText size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl font-extrabold text-white tracking-tight">
                  {summary.totalIssues}
                </span>
                <span className="block text-[11px] text-slate-400 mt-1">
                  Scope: {formatRoleLabel(currentUser.role)}
                </span>
              </div>
            </div>

            {/* Reported / New */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Reported / Awaiting Triage</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <IconAlertCircle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl font-extrabold text-amber-300 tracking-tight">
                  {summary.reported}
                </span>
                <span className="block text-[11px] text-slate-400 mt-1">
                  Requires initial review &amp; assignment
                </span>
              </div>
            </div>

            {/* In Progress */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Active Remediation</span>
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <IconClock size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl font-extrabold text-sky-300 tracking-tight">
                  {summary.inProgress}
                </span>
                <span className="block text-[11px] text-slate-400 mt-1">
                  Under Review, Assigned &amp; In Progress
                </span>
              </div>
            </div>

            {/* Resolved */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Resolved / Closed</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <IconCheckCircle size={16} />
                </div>
              </div>
              <div>
                <span className="text-3xl font-extrabold text-emerald-300 tracking-tight">
                  {summary.resolved}
                </span>
                <span className="block text-[11px] text-slate-400 mt-1">
                  Completed maintenance orders
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Status Breakdown Lifecycle */}
        <section
          aria-label="Lifecycle Status Breakdown"
          className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <IconLayers size={16} className="text-indigo-400" />
                <span>Issue Lifecycle Distribution</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time breakdown of all civic reports across operational stages.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Total Managed: {summary.totalIssues}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { key: 'REPORTED', label: 'Reported', count: statusBreakdown.REPORTED, color: 'bg-amber-500' },
              { key: 'UNDER_REVIEW', label: 'Under Review', count: statusBreakdown.UNDER_REVIEW, color: 'bg-sky-500' },
              { key: 'ASSIGNED', label: 'Assigned', count: statusBreakdown.ASSIGNED, color: 'bg-indigo-500' },
              { key: 'IN_PROGRESS', label: 'In Progress', count: statusBreakdown.IN_PROGRESS, color: 'bg-purple-500' },
              { key: 'RESOLVED', label: 'Resolved', count: statusBreakdown.RESOLVED, color: 'bg-emerald-500' },
              { key: 'CLOSED', label: 'Closed', count: statusBreakdown.CLOSED, color: 'bg-slate-500' },
            ].map((item) => {
              const pct = summary.totalIssues > 0 ? Math.round((item.count / totalCalculated) * 100) : 0;
              return (
                <div
                  key={item.key}
                  className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/60 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium text-[11px] truncate">
                      {item.label}
                    </span>
                    <span className="font-bold text-white">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${item.color} transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 text-right font-mono">
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Two-Column Section: Recent Issues vs Departments & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Recent Organization Issues */}
          <section className="lg:col-span-8 space-y-4" aria-label="Recent Organization Issues">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <IconFileText size={18} className="text-indigo-400" />
                  <span>Recent Issues</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Newest tickets submitted within this organization&apos;s jurisdiction.
                </p>
              </div>

              <Link
                href="/dashboard/issues"
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
              >
                <span>View My Reports</span>
                <IconChevronRight size={14} />
              </Link>
            </div>

            {recentIssues.length === 0 ? (
              <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <IconFileText size={24} />
                </div>
                <h3 className="text-sm font-bold text-white">No recent issues</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No issues have been reported for this organization yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/dashboard/issues/${issue.id}`}
                    className="block p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700/80 transition-all duration-150 space-y-2.5 shadow-sm group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                          {issue.issueNumber}
                        </span>
                        <PriorityBadge priority={issue.priority} size="sm" />
                        {issue.category && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
                            <IconTag size={11} className="text-indigo-400" />
                            <span>{issue.category.name}</span>
                          </span>
                        )}
                      </div>

                      <StatusBadge status={issue.status} size="sm" />
                    </div>

                    <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {issue.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {issue.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/60">
                      <span className="inline-flex items-center gap-1">
                        <IconCalendar size={12} className="text-slate-400" />
                        <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                      </span>

                      {issue.location?.landmark ? (
                        <span className="inline-flex items-center gap-1 text-slate-300">
                          <IconMapPin size={12} className="text-rose-400" />
                          <span className="truncate max-w-[220px]">{issue.location.landmark}</span>
                        </span>
                      ) : issue.location?.latitude ? (
                        <span className="font-mono text-slate-400 text-[10px]">
                          {issue.location.latitude.toFixed(4)}, {issue.location.longitude.toFixed(4)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Right Column (4 cols): Quick Actions & Department Overview */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Actions Panel */}
            <section
              aria-label="Operational Actions"
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-3"
            >
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <IconSparkles size={14} className="text-indigo-400" />
                <span>Operational Actions</span>
              </h2>

              <div className="space-y-2">
                <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 space-y-1">
                  <div className="text-xs font-semibold text-white">
                    Operational Scope
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {currentUser.role === 'ORG_OWNER' || currentUser.role === 'ORG_ADMIN'
                      ? 'You have organization-wide administration authority.'
                      : currentUser.role === 'MANAGER'
                      ? 'Your access is scoped to your assigned department(s).'
                      : currentUser.role === 'STAFF'
                      ? 'Your access is scoped to assigned work orders and service tasks.'
                      : 'Platform administrator oversight.'}
                  </p>
                </div>

                <Link
                  href="/dashboard/issues"
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <IconFileText size={15} className="text-indigo-400" />
                    <span>View Issues Log</span>
                  </span>
                  <IconChevronRight size={14} className="text-slate-400" />
                </Link>

                <div className="p-3 rounded-xl border border-dashed border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <span className="font-semibold text-slate-300 block">
                    Upcoming Capabilities
                  </span>
                  <p>
                    Full assignment dispatching, workflow remarks, and department staff rosters will unlock in the next release.
                  </p>
                </div>
              </div>
            </section>

            {/* Department Overview */}
            <section
              aria-label="Department Overview"
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <IconBuilding size={14} className="text-indigo-400" />
                  <span>Departments ({departments.length})</span>
                </h2>
                <span className="text-[10px] text-slate-400">Live Active Units</span>
              </div>

              {departments.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400">
                  No departments configured.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          {dept.name}
                        </span>
                        {dept.code && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300 font-semibold">
                            {dept.code}
                          </span>
                        )}
                      </div>

                      {dept.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {dept.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                        <span className="inline-flex items-center gap-1 text-slate-300">
                          <IconFileText size={11} className="text-amber-400" />
                          <span>{dept.activeIssueCount} active issue{dept.activeIssueCount === 1 ? '' : 's'}</span>
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <IconUsers size={11} className="text-slate-400" />
                          <span>{dept.memberCount} staff</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
