'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError, categoriesApi, organizationsApi } from '@/lib/api';
import { AnalyticsTimeRange, IssueCategory, OrganizationAnalyticsData, OrganizationDepartmentSummary } from '@/types';
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  IconArrowRight,
  IconBuilding,
  IconCheckCircle,
  IconClock,
  IconFileText,
  IconLayers,
  IconRefresh,
  IconShield,
  IconX,
} from '@/components/ui/Icons';

const TIME_RANGES: Array<{ value: AnalyticsTimeRange; label: string }> = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function roleLabel(role?: string): string {
  if (role === 'PLATFORM_ADMIN') return 'Platform Admin';
  if (role === 'ORG_OWNER') return 'Organization Owner';
  if (role === 'ORG_ADMIN') return 'Organization Admin';
  if (role === 'MANAGER') return 'Department Manager';
  if (role === 'STAFF') return 'Staff';
  return role || 'Organization user';
}

function MetricCard({ label, value, helper, icon: Icon, tone }: { label: string; value: string | number; helper: string; icon: React.ComponentType<{ size?: number; className?: string }>; tone: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-slate-400">{helper}</p></div><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></div></div></div>;
}

function AccessDenied({ onLogout }: { onLogout: () => void }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100"><div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-300"><IconShield size={28} /></div><div><h1 className="text-xl font-bold text-white">Organization analytics is restricted</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">Citizen accounts cannot access operational organization analytics.</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/dashboard" className="button-primary flex-1">Citizen Dashboard <IconArrowRight size={14} /></Link><button onClick={onLogout} className="button-secondary flex-1">Switch Account</button></div></div></div>;
}

function AnalyticsSkeleton() {
  return <div className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><Skeleton className="h-4 w-2/5" /><Skeleton className="mt-4 h-8 w-1/2" /><Skeleton className="mt-2 h-3 w-3/5" /></div>)}</div><div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-80 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><Skeleton className="h-5 w-2/5" /><Skeleton className="mt-4 h-64 w-full" /></div>)}</div></div>;
}

export default function OrganizationAnalyticsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const [analytics, setAnalytics] = useState<OrganizationAnalyticsData | null>(null);
  const [departments, setDepartments] = useState<OrganizationDepartmentSummary[]>([]);
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('30');
  const [departmentId, setDepartmentId] = useState('ALL');
  const [categoryId, setCategoryId] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAnalyticsAccess = user?.role !== 'USER';

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthLoading, isAuthenticated, router]);

  useEffect(() => {
    async function loadReferenceData() {
      const [departmentResult, categoryResult] = await Promise.allSettled([
        organizationsApi.getDepartments(),
        categoriesApi.list(),
      ]);
      if (departmentResult.status === 'fulfilled') setDepartments(departmentResult.value.departments || []);
      if (categoryResult.status === 'fulfilled') setCategories(categoryResult.value || []);
    }
    if (isAuthenticated && hasAnalyticsAccess) void loadReferenceData();
  }, [hasAnalyticsAccess, isAuthenticated]);

  const loadAnalytics = useCallback(async (refresh = false) => {
    if (!user || !hasAnalyticsAccess) return;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await organizationsApi.getAnalytics({
        timeRange,
        departmentId: departmentId === 'ALL' ? undefined : departmentId,
        categoryId: categoryId === 'ALL' ? undefined : categoryId,
      });
      setAnalytics(data);
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to load organization analytics.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [categoryId, departmentId, hasAnalyticsAccess, timeRange, user]);

  useEffect(() => {
    async function fetchAnalytics() {
      await loadAnalytics();
    }
    if (isAuthenticated && hasAnalyticsAccess) void fetchAnalytics();
  }, [hasAnalyticsAccess, isAuthenticated, loadAnalytics]);

  if (user?.role === 'USER') return <AccessDenied onLogout={logout} />;
  if (isAuthLoading || !isAuthenticated) return null;

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8 lg:py-8"><main className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg sm:flex-row sm:items-start sm:p-6"><div className="space-y-3"><div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><Link href="/org/dashboard" className="inline-flex items-center gap-1 font-medium text-indigo-300 hover:text-indigo-200"><IconBuilding size={14} /> Organization Operations</Link><span>/</span><span>Analytics</span></div><div><div className="mb-2 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Organization Analytics</h1><span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">{roleLabel(user?.role)}</span></div><p className="max-w-2xl text-sm leading-relaxed text-slate-400">Factual operational reporting for {analytics?.organization.name || 'your organization'}, calculated from issue records and authoritative timestamps.</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => void loadAnalytics(true)} disabled={isRefreshing} className="button-secondary"><IconRefresh size={14} className={isRefreshing ? 'animate-spin' : ''} />{isRefreshing ? 'Refreshing...' : 'Refresh'}</button><Link href="/org/issues" className="button-secondary">Issue Management <IconArrowRight size={14} /></Link></div></header>

    {error && <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert"><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error"><IconX size={16} /></button></div>}

    {isLoading && !analytics ? <AnalyticsSkeleton /> : analytics ? <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Issue summary"><MetricCard label="Total issues" value={analytics.summary.totalIssues} helper="Selected scope" icon={IconFileText} tone="bg-indigo-500/10 text-indigo-300" /><MetricCard label="Open issues" value={analytics.summary.openIssues} helper="Not resolved or closed" icon={IconLayers} tone="bg-amber-500/10 text-amber-300" /><MetricCard label="In progress" value={analytics.summary.inProgress} helper="Currently being worked" icon={IconClock} tone="bg-sky-500/10 text-sky-300" /><MetricCard label="Resolved" value={analytics.summary.resolved} helper="Resolved status" icon={IconCheckCircle} tone="bg-emerald-500/10 text-emerald-300" /><MetricCard label="Closed" value={analytics.summary.closed} helper="Closed status" icon={IconCheckCircle} tone="bg-slate-700/60 text-slate-300" /></section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm" aria-label="Analytics filters"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-white">Analytics filters</h2><p className="text-xs text-slate-500">All charts and metrics update together. Dates are grouped in UTC.</p></div><span className="text-xs text-slate-500">{TIME_RANGES.find((option) => option.value === timeRange)?.label}</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="space-y-1.5 text-xs font-semibold text-slate-400">Time range<select value={timeRange} onChange={(event) => setTimeRange(event.target.value as AnalyticsTimeRange)} className="input"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select></label><label className="space-y-1.5 text-xs font-semibold text-slate-400">Department<select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="input"><option value="ALL">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="space-y-1.5 text-xs font-semibold text-slate-400">Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="input"><option value="ALL">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div></section>

      <AnalyticsCharts byStatus={analytics.byStatus} byPriority={analytics.byPriority} byCategory={analytics.byCategory} byDepartment={analytics.byDepartment} trend={analytics.trend} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm"><div className="mb-4"><h2 className="text-sm font-bold text-white">Resolution metrics</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">Metrics use authoritative resolved_at and closed_at timestamps. Average time excludes issues without a resolved timestamp.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500">Resolution rate</p><p className="mt-2 text-2xl font-extrabold text-white">{analytics.resolution.resolutionRate === null ? '—' : `${analytics.resolution.resolutionRate}%`}</p><p className="mt-1 text-xs text-slate-400">Resolved / total issues</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500">Average resolution time</p><p className="mt-2 text-2xl font-extrabold text-white">{analytics.resolution.averageResolutionHours === null ? '—' : `${analytics.resolution.averageResolutionHours}h`}</p><p className="mt-1 text-xs text-slate-400">Sample: {analytics.resolution.averageSampleSize} resolved issues</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500">Resolved count</p><p className="mt-2 text-2xl font-extrabold text-emerald-300">{analytics.resolution.resolvedCount}</p><p className="mt-1 text-xs text-slate-400">Timestamp available</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500">Closed count</p><p className="mt-2 text-2xl font-extrabold text-slate-200">{analytics.resolution.closedCount}</p><p className="mt-1 text-xs text-slate-400">Closed timestamp available</p></div></div></section>

      <p className="text-right text-[11px] text-slate-600">Data scope: {analytics.organization.name} · Timezone: {analytics.filters.timezone}</p>
    </> : <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-sm text-slate-400">No analytics data available.</div>}
  </main></div>;
}
