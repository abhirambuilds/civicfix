import React from 'react';
import { IssuePriority } from '@/types';

interface PriorityBadgeProps {
  priority?: IssuePriority | null;
  size?: 'sm' | 'md';
}

const PRIORITY_CONFIG: Record<
  IssuePriority,
  { label: string; badgeClass: string; barCount: number; barClass: string }
> = {
  LOW: {
    label: 'Low',
    badgeClass: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
    barCount: 1,
    barClass: 'bg-slate-400',
  },
  MEDIUM: {
    label: 'Medium',
    badgeClass: 'bg-sky-950/50 text-sky-300 border-sky-800/50',
    barCount: 2,
    barClass: 'bg-sky-400',
  },
  HIGH: {
    label: 'High',
    badgeClass: 'bg-amber-950/50 text-amber-300 border-amber-800/50',
    barCount: 3,
    barClass: 'bg-amber-400',
  },
  CRITICAL: {
    label: 'Critical',
    badgeClass: 'bg-rose-950/60 text-rose-300 border-rose-800/60 font-semibold',
    barCount: 4,
    barClass: 'bg-rose-400',
  },
};

export function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5',
  }[size];

  if (!priority) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-slate-700/60 bg-slate-800/40 text-slate-400 ${sizeClasses} whitespace-nowrap`}
        aria-label="Priority: Pending Triage"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" aria-hidden="true" />
        <span>Pending Triage</span>
      </span>
    );
  }

  const config = PRIORITY_CONFIG[priority] || {
    label: priority,
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    barCount: 1,
    barClass: 'bg-slate-400',
  };


  return (
    <span
      className={`inline-flex items-center rounded-md border ${config.badgeClass} ${sizeClasses} whitespace-nowrap`}
      aria-label={`Priority: ${config.label}`}
    >
      {/* 4-bar indicator for accessible visual priority */}
      <span className="inline-flex items-end gap-0.5 h-2.5" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={`w-0.5 rounded-full ${
              bar <= config.barCount ? config.barClass : 'bg-slate-700/60'
            }`}
            style={{ height: `${bar * 25}%` }}
          />
        ))}
      </span>
      <span>{config.label}</span>
    </span>
  );
}
