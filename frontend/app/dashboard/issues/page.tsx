'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { issuesApi, categoriesApi } from '@/lib/api';
import { Issue, IssueCategory } from '@/types';
import { IssueCard } from '@/components/dashboard/IssueCard';
import { CardSkeleton } from '@/components/ui/Skeleton';
import {
  IconSearch,
  IconFilter,
  IconPlusCircle,
  IconRefresh,
  IconChevronLeft,
  IconChevronRight,
  IconFileText,
} from '@/components/ui/Icons';

export default function MyIssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [categories, setCategories] = useState<IssueCategory[]>([]);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load available categories once
  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      try {
        const catList = await categoriesApi.list();
        if (isMounted) setCategories(catList);
      } catch {
        // Fallback gracefully
      }
    }
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshIssues = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await issuesApi.list({
        search: debouncedSearch.trim() || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        categoryId: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        page,
        limit: 10,
      });

      setIssues(result.issues || []);
      if (result.pagination) {
        setTotalPages(result.pagination.totalPages || 1);
        setTotalCount(result.pagination.total || 0);
      } else {
        setTotalCount(result.issues?.length || 0);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load issues. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, selectedStatus, selectedCategory, page]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const result = await issuesApi.list({
          search: debouncedSearch.trim() || undefined,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          categoryId: selectedCategory !== 'ALL' ? selectedCategory : undefined,
          page,
          limit: 10,
        });

        if (isMounted) {
          setIssues(result.issues || []);
          if (result.pagination) {
            setTotalPages(result.pagination.totalPages || 1);
            setTotalCount(result.pagination.total || 0);
          } else {
            setTotalCount(result.issues?.length || 0);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Unable to load issues. Please try again.';
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, selectedStatus, selectedCategory, page]);

  const handleClearFilters = () => {
    setSearch('');
    setSelectedStatus('ALL');
    setSelectedCategory('ALL');
    setPage(1);
  };

  const statusOptions: Array<{ value: string; label: string }> = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'REPORTED', label: 'Reported' },
    { value: 'UNDER_REVIEW', label: 'Under Review' },
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            My Reported Issues
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Search, filter, and track all civic tickets submitted from your account.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshIssues}
            disabled={isLoading}
            title="Refresh list"
            aria-label="Refresh issues list"
            className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <IconRefresh size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <Link
            href="/dashboard/report"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <IconPlusCircle size={16} />
            <span>Report Issue</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Field */}
          <div className="sm:col-span-6 relative">
            <IconSearch
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your issues..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              aria-label="Search issues"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
              aria-label="Filter by status"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
              aria-label="Filter by category"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(debouncedSearch || selectedStatus !== 'ALL' || selectedCategory !== 'ALL') && (
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <IconFilter size={13} className="text-indigo-400" />
              <span>
                Filtering applied &bull; Found {totalCount} matching report{totalCount === 1 ? '' : 's'}
              </span>
            </div>
            <button
              onClick={handleClearFilters}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/30 text-rose-300 flex items-center justify-between"
        >
          <span className="text-sm">{error}</span>
          <button
            onClick={refreshIssues}
            className="px-3 py-1 rounded bg-rose-900/50 hover:bg-rose-900 text-xs text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Issues List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <CardSkeleton key={n} />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <IconFileText size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No issues found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {debouncedSearch || selectedStatus !== 'ALL' || selectedCategory !== 'ALL'
                ? 'No issues match your search.'
                : "You haven't reported any issues yet."}
            </p>
          </div>
          {debouncedSearch || selectedStatus !== 'ALL' || selectedCategory !== 'ALL' ? (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              Reset Filters
            </button>
          ) : (
            <Link
              href="/dashboard/report"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <IconPlusCircle size={16} />
              <span>Report an Issue</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && totalPages > 1 && (
        <div className="pt-4 flex items-center justify-between border-t border-slate-800 text-xs text-slate-400">
          <div>
            Showing Page <strong className="text-slate-200">{page}</strong> of{' '}
            <strong className="text-slate-200">{totalPages}</strong> ({totalCount} total)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <IconChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <span>Next</span>
              <IconChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
