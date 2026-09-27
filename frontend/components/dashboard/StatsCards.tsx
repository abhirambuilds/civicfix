import React from 'react';
import {
  IconFileText,
  IconClock,
  IconCheckCircle,
  IconAlertCircle,
} from '@/components/ui/Icons';

interface StatsCardsProps {
  total: number;
  underReview: number;
  inProgress: number;
  resolved: number;
}

export function StatsCards({
  total,
  underReview,
  inProgress,
  resolved,
}: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Reports',
      count: total,
      description: 'Total issues submitted by you',
      icon: IconFileText,
      accent: 'from-indigo-500/20 to-indigo-500/5',
      iconColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      badgeClass: 'text-indigo-300',
    },
    {
      title: 'Under Review',
      count: underReview,
      description: 'Awaiting triage or review',
      icon: IconClock,
      accent: 'from-amber-500/20 to-amber-500/5',
      iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      badgeClass: 'text-amber-300',
    },
    {
      title: 'In Progress',
      count: inProgress,
      description: 'Assigned & active resolution',
      icon: IconAlertCircle,
      accent: 'from-sky-500/20 to-sky-500/5',
      iconColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      badgeClass: 'text-sky-300',
    },
    {
      title: 'Resolved',
      count: resolved,
      description: 'Fixed & verified closures',
      icon: IconCheckCircle,
      accent: 'from-emerald-500/20 to-emerald-500/5',
      iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      badgeClass: 'text-emerald-300',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.title}
            className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-sm transition-all hover:border-slate-700/80 bg-gradient-to-b ${card.accent}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {card.title}
              </span>
              <div
                className={`w-9 h-9 rounded-lg border flex items-center justify-center ${card.iconColor}`}
                aria-hidden="true"
              >
                <IconComponent size={18} />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {card.count}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-400">
              {card.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
