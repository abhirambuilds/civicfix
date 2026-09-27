import React from 'react';
import { IssueStatus } from '@/types';

interface StatusBadgeProps {
  status: IssueStatus;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

const STATUS_CONFIG: Record<
  IssueStatus,
  { label: string; badgeClass: string; dotClass: string; pulse: boolean }
> = {
  REPORTED: {
    label: 'Reported',
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-400',
    pulse: false,
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    badgeClass: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    dotClass: 'bg-sky-400',
    pulse: true,
  },
  ASSIGNED: {
    label: 'Assigned',
    badgeClass: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    dotClass: 'bg-indigo-400',
    pulse: false,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-400',
    pulse: true,
  },
  RESOLVED: {
    label: 'Resolved',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
    pulse: false,
  },
  CLOSED: {
    label: 'Closed',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    dotClass: 'bg-slate-500',
    pulse: false,
  },
};

export function StatusBadge({
  status,
  size = 'md',
  showPulse = true,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    dotClass: 'bg-slate-400',
    pulse: false,
  };

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.badgeClass} ${sizeClasses} whitespace-nowrap`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <span
        className={`rounded-full ${dotSize} ${config.dotClass} ${
          showPulse && config.pulse ? 'animate-pulse' : ''
        }`}
        aria-hidden="true"
      />
      <span>{config.label}</span>
    </span>
  );
}
