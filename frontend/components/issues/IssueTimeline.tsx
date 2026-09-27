'use client';

import React from 'react';
import { IssueStatus, IssueStatusHistory } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  IconCheckCircle,
  IconClock,
  IconCalendar,
} from '@/components/ui/Icons';

interface IssueTimelineProps {
  currentStatus: IssueStatus;
  statusHistory?: IssueStatusHistory[];
  createdAt?: string;
}

const LIFECYCLE_ORDER: IssueStatus[] = [
  'REPORTED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

export function IssueTimeline({
  currentStatus,
  statusHistory = [],
  createdAt,
}: IssueTimelineProps) {
  // Sort history chronologically (oldest first)
  const sortedHistory = [...statusHistory].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // If statusHistory is empty, construct synthetic initial event from createdAt
  const displayEvents =
    sortedHistory.length > 0
      ? sortedHistory
      : [
          {
            id: 'initial-reported',
            newStatus: 'REPORTED' as IssueStatus,
            previousStatus: null,
            remark: 'Report submitted by citizen.',
            createdAt: createdAt || new Date().toISOString(),
            changedBy: null,
          },
        ];

  const currentStepIndex = LIFECYCLE_ORDER.indexOf(currentStatus);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 backdrop-blur-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <IconClock size={16} className="text-indigo-400" />
            <span>Status &amp; Lifecycle Timeline</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit history tracking progress from Reported &rarr; Resolution
          </p>
        </div>

        <StatusBadge status={currentStatus} size="sm" />
      </div>

      {/* Mini Lifecycle Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
          <span>Lifecycle Stage</span>
          <span className="text-indigo-300 font-semibold capitalize">
            {currentStatus.replace('_', ' ').toLowerCase()} ({Math.min(currentStepIndex + 1, 6)}/6)
          </span>
        </div>

        <div className="grid grid-cols-6 gap-1.5 h-2 rounded-full overflow-hidden bg-slate-950 p-0.5 border border-slate-800">
          {LIFECYCLE_ORDER.map((stage, idx) => {
            const isCompleted = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={stage}
                title={stage.replace('_', ' ')}
                className={`rounded-full transition-all duration-300 ${
                  isCurrent
                    ? 'bg-indigo-500 animate-pulse'
                    : isCompleted
                    ? 'bg-emerald-500/80'
                    : 'bg-slate-800/60'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Actual Chronological Events Log */}
      <div className="space-y-4 pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recorded Audit Transitions ({displayEvents.length})
        </h4>

        <ol className="relative border-l border-slate-800 ml-3.5 space-y-6" role="list">
          {displayEvents.map((event, index) => {
            const isLatest = index === displayEvents.length - 1;
            const formattedDate = new Date(event.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const formattedTime = new Date(event.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            });

            return (
              <li key={event.id || index} className="ml-6 relative">
                {/* Node marker */}
                <div
                  className={`absolute -left-[35px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                    isLatest
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900 border-slate-700 text-emerald-400'
                  }`}
                  aria-hidden="true"
                >
                  {isLatest ? (
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  ) : (
                    <IconCheckCircle size={13} />
                  )}
                </div>

                {/* Event Details */}
                <div className="flex flex-col space-y-1.5 p-3 rounded-xl border border-slate-800/80 bg-slate-950/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={event.newStatus} size="sm" />
                      {isLatest && (
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          Current Stage
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <IconCalendar size={12} className="text-slate-400" />
                      <span>{formattedDate}, {formattedTime}</span>
                    </div>
                  </div>

                  {/* Optional Transition Remark */}
                  {event.remark && (
                    <p className="text-xs text-slate-300 leading-relaxed pt-1">
                      <span className="text-slate-400 font-medium">Note: </span>
                      &ldquo;{event.remark}&rdquo;
                    </p>
                  )}

                  {/* Actor information if safely exposed */}
                  {event.changedBy?.name && (
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                      <span>
                        Action logged by: <strong className="text-slate-300">{event.changedBy.name}</strong>
                      </span>
                      {event.changedBy.role && (
                        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                          {event.changedBy.role}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
