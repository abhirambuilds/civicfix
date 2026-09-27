'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { issuesApi } from '@/lib/api';
import { Issue } from '@/types';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { IssueCard } from '@/components/dashboard/IssueCard';
import { CardSkeleton, StatsCardSkeleton } from '@/components/ui/Skeleton';
import {
  IconPlusCircle,
  IconRefresh,
  IconArrowRight,
  IconAlertCircle,
  IconFileText,
} from '@/components/ui/Icons';

export default function DashboardPage() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await issuesApi.list({ limit: 10 });
      setIssues(result.issues || []);
      setTotalCount(result.pagination?.total || (result.issues?.length ?? 0));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to load your issues. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialLoad() {
      try {
        const result = await issuesApi.list({ limit: 10 });
        if (isMounted) {
          setIssues(result.issues || []);
          setTotalCount(result.pagination?.total || (result.issues?.length ?? 0));
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to load your issues. Please try again.';
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute live user metrics from backend data
  const underReviewCount = issues.filter(
    (i) => i.status === 'REPORTED' || i.status === 'UNDER_REVIEW'
  ).length;

  const inProgressCount = issues.filter(
    (i) => i.status === 'ASSIGNED' || i.status === 'IN_PROGRESS'
  ).length;

  const resolvedCount = issues.filter(
    (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
  ).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 sm:p-8 backdrop-blur-sm shadow-lg shadow-indigo-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <span>SRM Campus Student Portal</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome, {user?.name || 'Citizen'}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              Track the civic and campus issues you&apos;ve reported, monitor real-time
              status updates, and review resolution progress directly from administrative departments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={loadDashboard}
              disabled={isLoading}
              title="Refresh data"
              aria-label="Refresh dashboard data"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <IconRefresh
                size={15}
                className={isLoading ? 'animate-spin' : ''}
              />
              <span>Refresh</span>
            </button>

            <Link
              href="/dashboard/report"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <IconPlusCircle size={18} />
              <span>Report an Issue</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Issue Metrics Summary
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <StatsCardSkeleton key={n} />
            ))}
          </div>
        ) : (
          <StatsCards
            total={totalCount}
            underReview={underReviewCount}
            inProgress={inProgressCount}
            resolved={resolvedCount}
          />
        )}
      </section>

      {/* Error Notice */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/30 text-rose-300 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <IconAlertCircle size={20} className="text-rose-400 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button
            onClick={loadDashboard}
            className="px-3 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 text-xs font-semibold text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Recent Issues Section */}
      <section aria-labelledby="recent-issues-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3
              id="recent-issues-heading"
              className="text-lg font-bold text-white tracking-tight"
            >
              Recent Issues
            </h3>
            {!isLoading && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                {issues.length} of {totalCount}
              </span>
            )}
          </div>

          <Link
            href="/dashboard/issues"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <span>View All Issues</span>
            <IconArrowRight size={14} />
          </Link>
        </div>

        {/* Content State: Loading, Empty, or List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <CardSkeleton key={n} />
            ))}
          </div>
        ) : issues.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <IconFileText size={28} />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">
                No issues reported yet
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Spot a streetlight out, broken pavement, or waste disposal issue?
                Report it to get it triaged and resolved by campus administration.
              </p>
            </div>
            <Link
              href="/dashboard/report"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              <IconPlusCircle size={16} />
              <span>Report your first issue</span>
            </Link>
          </div>
        ) : (
          /* Recent Issues List */
          <div className="grid grid-cols-1 gap-3.5">
            {issues.slice(0, 5).map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
