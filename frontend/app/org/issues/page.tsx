'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { issuesApi, categoriesApi, organizationsApi, ApiError } from '@/lib/api';
import {
  Issue,
  IssueCategory,
  OrganizationDepartmentSummary,
  PaginationMeta,
} from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  IconBuilding,
  IconLayers,
  IconSearch,
  IconRefresh,
  IconChevronRight,
  IconChevronLeft,
  IconTag,
  IconCalendar,
  IconAlertCircle,
  IconShield,
  IconUser,
  IconX,
  IconFileText,
} from '@/components/ui/Icons';

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Reported', value: 'REPORTED' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Closed', value: 'CLOSED' },
];

const PRIORITY_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Priorities', value: 'ALL' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
];

const SORT_OPTIONS: { label: string; sort: string; order: 'asc' | 'desc' }[] = [
  { label: 'Newest First', sort: 'createdAt', order: 'desc' },
  { label: 'Oldest First', sort: 'createdAt', order: 'asc' },
  { label: 'Priority (High to Low)', sort: 'priority', order: 'desc' },
  { label: 'Status', sort: 'status', order: 'asc' },
];

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

export default function OrgIssuesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Organization meta & filter reference data
  const [orgName, setOrgName] = useState<string>('');
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [departments, setDepartments] = useState<OrganizationDepartmentSummary[]>([]);

  // Query state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedSort, setSelectedSort] = useState<number>(0); // Index in SORT_OPTIONS
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Issues and pagination data
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Auth redirect for unauthenticated users
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load organization reference data (org context, categories, departments)
  useEffect(() => {
    if (user?.role === 'USER') return;

    let isMounted = true;
    async function loadMeta() {
      try {
        const [dashData, catsData, deptsData] = await Promise.allSettled([
          organizationsApi.getDashboard(),
          categoriesApi.list(),
          organizationsApi.getDepartments(),
        ]);

        if (!isMounted) return;

        if (dashData.status === 'fulfilled') {
          setOrgName(dashData.value.organization.name);
          if (dashData.value.departments?.length > 0) {
            setDepartments(dashData.value.departments);
          }
        }

        if (catsData.status === 'fulfilled') {
          setCategories(catsData.value);
        }

        if (deptsData.status === 'fulfilled' && deptsData.value?.departments) {
          setDepartments(deptsData.value.departments);
        }
      } catch {
        // Fallback gracefully to default values
      }
    }

    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [user?.role]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    if (user?.role === 'USER') return;
    setIsRefreshing(true);
    try {
      const sortCfg = SORT_OPTIONS[selectedSort] || SORT_OPTIONS[0];
      const result = await issuesApi.list({
        search: debouncedSearch.trim() || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        categoryId: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        departmentId: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
        priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
        sort: sortCfg.sort,
        order: sortCfg.order,
        page: currentPage,
        limit: 15,
      });
      setIssues(result.issues || []);
      setPagination(result.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
      setError(null);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Unable to retrieve organization issues.';
      setError(msg);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    user?.role,
    debouncedSearch,
    selectedStatus,
    selectedCategory,
    selectedDepartment,
    selectedPriority,
    selectedSort,
    currentPage,
  ]);

  // Load issues when filters or page change
  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (user?.role === 'USER') return;
      try {
        const sortCfg = SORT_OPTIONS[selectedSort] || SORT_OPTIONS[0];
        const result = await issuesApi.list({
          search: debouncedSearch.trim() || undefined,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          categoryId: selectedCategory !== 'ALL' ? selectedCategory : undefined,
          departmentId: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
          priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
          sort: sortCfg.sort,
          order: sortCfg.order,
          page: currentPage,
          limit: 15,
        });

        if (isMounted) {
          setIssues(result.issues || []);
          setPagination(result.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
          setError(null);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
              ? err.message
              : 'Unable to retrieve organization issues.';
          setError(msg);
          setIssues([]);
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [
    user?.role,
    debouncedSearch,
    selectedStatus,
    selectedCategory,
    selectedDepartment,
    selectedPriority,
    selectedSort,
    currentPage,
  ]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedStatus('ALL');
    setSelectedCategory('ALL');
    setSelectedDepartment('ALL');
    setSelectedPriority('ALL');
    setSelectedSort(0);
    setCurrentPage(1);
  };

  const hasActiveFilters =
    debouncedSearch !== '' ||
    selectedStatus !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedDepartment !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    selectedSort !== 0;

  // Access control view for normal citizen users
  if (!isAuthLoading && user?.role === 'USER') {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
        <div className="p-8 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-900/40 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
            <IconShield size={28} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Access Restricted: Organization Issue Management
          </h2>
          <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            The Organization Issue Management interface is reserved for campus administration,
            department managers, and field technician staff. Standard student/citizen accounts cannot access
            administrative ticket management.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-150"
            >
              <span>Return to Citizen Dashboard</span>
              <IconChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/80">
              <IconBuilding size={13} className="text-indigo-400" />
              <span>{orgName || 'Campus Administration'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
              <IconShield size={13} className="text-emerald-400" />
              <span>{formatRoleLabel(user?.role)}</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <IconLayers className="text-indigo-400" size={26} />
            <span>Issue Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Review and manage issues reported within your organization.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors shadow-sm disabled:opacity-50"
          >
            <IconRefresh
              size={14}
              className={`text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>

          <Link
            href="/org/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors shadow-sm"
          >
            <IconChevronLeft size={14} />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <IconAlertCircle size={18} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="text-xs font-bold text-rose-300 hover:text-rose-200 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-md shadow-md space-y-4">
        {/* Search Input Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <IconSearch size={16} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by issue #, title, description, or keyword..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-700 bg-slate-950/80 text-slate-100 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                aria-label="Clear search"
              >
                <IconX size={15} />
              </button>
            )}
          </div>

          {/* Quick Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors shrink-0"
            >
              <IconX size={14} className="text-slate-400" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Priority
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Sort By
            </label>
            <select
              value={selectedSort}
              onChange={(e) => {
                setSelectedSort(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {SORT_OPTIONS.map((opt, idx) => (
                <option key={idx} value={idx}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Issues Table / List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden shadow-lg">
        {/* Table Summary Bar */}
        <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">
              {pagination.total} {pagination.total === 1 ? 'issue' : 'issues'} found
            </span>
            {hasActiveFilters && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                Filtered view
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400">
            Page {pagination.page} of {pagination.totalPages}
          </div>
        </div>

        {/* Loading Skeletons */}
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-28 rounded" />
                  <Skeleton className="h-5 w-20 rounded" />
                </div>
                <Skeleton className="h-4 w-3/4 rounded" />
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-4 w-32 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : issues.length === 0 ? (
          /* Empty States */
          <div className="py-20 px-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto border border-slate-700/60">
              <IconFileText size={28} />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-white">
                {hasActiveFilters ? 'No issues match your filters' : 'No issues found'}
              </h3>
              <p className="text-xs text-slate-400">
                {hasActiveFilters
                  ? 'Try clearing search keywords or loosening status, category, and department filters.'
                  : 'There are currently no civic issues reported for this organization.'}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-indigo-300 transition-colors"
              >
                <span>Clear all filters</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Issue #</th>
                    <th className="py-3 px-4">Title &amp; Summary</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Assigned Staff</th>
                    <th className="py-3 px-4">Reported</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {issues.map((issue) => {
                    const activeAssignment = issue.assignments?.find(
                      (a) => a.isActive !== false
                    );
                    const deptName =
                      activeAssignment?.department?.name || 'Unassigned';
                    const staffName =
                      activeAssignment?.assignedUser?.name || 'Not assigned';

                    return (
                      <tr
                        key={issue.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-indigo-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                            {issue.issueNumber}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <Link
                            href={`/org/issues/${issue.id}`}
                            className="font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors block truncate"
                          >
                            {issue.title}
                          </Link>
                          <p className="text-[11px] text-slate-400 truncate">
                            {issue.description}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300">
                            <IconTag size={11} className="text-indigo-400" />
                            <span>{issue.category?.name || 'General'}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                              deptName !== 'Unassigned'
                                ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-900/60'
                                : 'bg-slate-800/60 text-slate-400'
                            }`}
                          >
                            <span>{deptName}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={issue.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <PriorityBadge priority={issue.priority} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <IconUser
                              size={12}
                              className={
                                staffName !== 'Not assigned'
                                  ? 'text-indigo-400'
                                  : 'text-slate-400'
                              }
                            />
                            <span
                              className={
                                staffName === 'Not assigned'
                                  ? 'text-slate-400 italic'
                                  : ''
                              }
                            >
                              {staffName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                          {new Date(issue.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <Link
                            href={`/org/issues/${issue.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-[11px] transition-colors shadow-sm"
                          >
                            <span>Manage</span>
                            <IconChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Stacked Cards View */}
            <div className="lg:hidden divide-y divide-slate-800/80">
              {issues.map((issue) => {
                const activeAssignment = issue.assignments?.find(
                  (a) => a.isActive !== false
                );
                const deptName =
                  activeAssignment?.department?.name || 'Unassigned';
                const staffName =
                  activeAssignment?.assignedUser?.name || 'Not assigned';

                return (
                  <div
                    key={issue.id}
                    className="p-4 sm:p-5 space-y-3 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {issue.issueNumber}
                      </span>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={issue.priority} size="sm" />
                        <StatusBadge status={issue.status} size="sm" />
                      </div>
                    </div>

                    <div>
                      <Link
                        href={`/org/issues/${issue.id}`}
                        className="font-bold text-sm text-slate-100 hover:text-indigo-300 transition-colors block"
                      >
                        {issue.title}
                      </Link>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                        {issue.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span className="inline-flex items-center gap-1">
                        <IconTag size={12} className="text-indigo-400" />
                        <span>{issue.category?.name || 'General'}</span>
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <IconBuilding size={12} className="text-slate-400" />
                        <span>{deptName}</span>
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <IconUser size={12} className="text-slate-400" />
                        <span>{staffName}</span>
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <IconCalendar size={12} className="text-slate-400" />
                        <span>
                          {new Date(issue.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                    </div>

                    <div className="pt-1">
                      <Link
                        href={`/org/issues/${issue.id}`}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold text-xs border border-slate-700/80 transition-colors"
                      >
                        <span>View Details &amp; Operational Controls</span>
                        <IconChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-400">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} issues
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={pagination.page <= 1 || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <IconChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <span className="px-2 font-medium text-slate-300">
                {pagination.page} / {pagination.totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, pagination.totalPages))
                }
                disabled={pagination.page >= pagination.totalPages || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <IconChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
