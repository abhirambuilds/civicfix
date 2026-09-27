import React from 'react';
import Link from 'next/link';
import { Issue } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import {
  IconMapPin,
  IconCalendar,
  IconTag,
  IconImage,
  IconMessageSquare,
  IconArrowRight,
} from '@/components/ui/Icons';

interface IssueCardProps {
  issue: Issue;
}

export function IssueCard({ issue }: IssueCardProps) {
  const formattedDate = new Date(issue.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const locationLabel =
    issue.location?.landmark ||
    issue.location?.address ||
    (issue.location?.latitude && issue.location?.longitude
      ? `${issue.location.latitude.toFixed(4)}, ${issue.location.longitude.toFixed(4)}`
      : 'Campus Location');

  const imageCount = issue._count?.images ?? issue.images?.length ?? 0;
  const commentCount = issue._count?.comments ?? issue.comments?.length ?? 0;

  return (
    <div className="group relative rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700/80 transition-all duration-200 p-5 shadow-sm hover:shadow-md hover:shadow-indigo-500/5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/80">
            {issue.issueNumber}
          </span>
          <PriorityBadge priority={issue.priority} size="sm" />
        </div>
        <StatusBadge status={issue.status} size="sm" />
      </div>

      <Link
        href={`/dashboard/issues/${issue.id}`}
        className="block focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
      >
        <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-1 mb-1.5">
          {issue.title}
        </h3>
        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed mb-4">
          {issue.description}
        </p>
      </Link>

      <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-y-2 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {issue.category && (
            <span className="inline-flex items-center gap-1 text-slate-300">
              <IconTag size={13} className="text-indigo-400" />
              <span>{issue.category.name}</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-slate-400 max-w-[200px] truncate" title={locationLabel}>
            <IconMapPin size={13} className="text-rose-400 shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </span>

          <span className="inline-flex items-center gap-1 text-slate-400">
            <IconCalendar size={13} className="text-slate-400 shrink-0" />
            <span>{formattedDate}</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {imageCount > 0 && (
            <span className="inline-flex items-center gap-1 text-slate-400" title={`${imageCount} photo attachment(s)`}>
              <IconImage size={13} className="text-sky-400" />
              <span>{imageCount}</span>
            </span>
          )}

          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-slate-400" title={`${commentCount} comment(s)`}>
              <IconMessageSquare size={13} className="text-emerald-400" />
              <span>{commentCount}</span>
            </span>
          )}

          <Link
            href={`/dashboard/issues/${issue.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors pl-2"
            aria-label={`View details for issue ${issue.issueNumber}`}
          >
            <span>View</span>
            <IconArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
