import React from 'react';
import { IssueStatus, IssueStatusHistory } from '@/types';
import { IconCheckCircle } from '@/components/ui/Icons';

interface IssueTimelineProps {
  currentStatus: IssueStatus;
  statusHistory?: IssueStatusHistory[];
  createdAt?: string;
}

const LIFECYCLE_STEPS: Array<{
  status: IssueStatus;
  label: string;
  description: string;
}> = [
  {
    status: 'REPORTED',
    label: 'Reported',
    description: 'Submitted by citizen/student',
  },
  {
    status: 'UNDER_REVIEW',
    label: 'Under Review',
    description: 'Triage by organization admin',
  },
  {
    status: 'ASSIGNED',
    label: 'Assigned',
    description: 'Assigned to maintenance department',
  },
  {
    status: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Active on-site inspection or repair',
  },
  {
    status: 'RESOLVED',
    label: 'Resolved',
    description: 'Remediation completed & documented',
  },
  {
    status: 'CLOSED',
    label: 'Closed',
    description: 'Administrative verification & closure',
  },
];

export function IssueTimeline({
  currentStatus,
  statusHistory = [],
  createdAt,
}: IssueTimelineProps) {
  const currentIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === currentStatus);

  // Map events from status history
  const historyMap = new Map<IssueStatus, IssueStatusHistory>();
  statusHistory.forEach((h) => {
    historyMap.set(h.newStatus, h);
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-4 flex items-center justify-between">
        <span>Lifecycle Status Timeline</span>
        <span className="text-xs font-normal text-slate-400 capitalize">
          Current: <strong className="text-white font-medium">{currentStatus.replace('_', ' ')}</strong>
        </span>
      </h3>

      <ol className="relative border-l border-slate-800 ml-3.5 space-y-6" role="list">
        {LIFECYCLE_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          const historyEntry = historyMap.get(step.status);
          const timestamp =
            historyEntry?.createdAt || (step.status === 'REPORTED' ? createdAt : null);

          const formattedDate = timestamp
            ? new Date(timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : null;

          return (
            <li
              key={step.status}
              className="ml-6 relative"
              aria-current={isCurrent ? 'step' : undefined}
            >
              {/* Timeline Node Indicator */}
              <div
                className={`absolute -left-[35px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                  isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : isCurrent
                    ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 shadow-sm shadow-indigo-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-600'
                }`}
              >
                {isCompleted ? (
                  <IconCheckCircle size={14} />
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                )}
              </div>

              {/* Step Content */}
              <div className="flex flex-col">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={`text-sm font-semibold ${
                      isCompleted
                        ? 'text-slate-200'
                        : isCurrent
                        ? 'text-indigo-300 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>

                  {isCurrent && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Active State
                    </span>
                  )}

                  {formattedDate && (
                    <span className="text-xs text-slate-400 ml-auto">
                      {formattedDate}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-0.5">
                  {step.description}
                </p>

                {/* Audit Remark if present */}
                {historyEntry?.remark && (
                  <div className="mt-2 text-xs p-2.5 rounded-md bg-slate-950/60 border border-slate-800/80 text-slate-300">
                    <span className="text-slate-400 font-medium">Official Remark: </span>
                    <span>&ldquo;{historyEntry.remark}&rdquo;</span>
                    {historyEntry.changedBy?.name && (
                      <span className="block text-[10px] text-slate-400 mt-1">
                        Recorded by: {historyEntry.changedBy.name} ({historyEntry.changedBy.role})
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
  );
}
