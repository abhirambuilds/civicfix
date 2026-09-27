'use client';

import { useEffect, useState } from 'react';
import { issuesApi } from '@/lib/api';
import { IssueAiRouting } from '@/types';
import { IconAlertCircle, IconClock, IconLayers } from '@/components/ui/Icons';

export function AISmartRoutingCard({ issueId }: { issueId: string }) {
  const [routing, setRouting] = useState<IssueAiRouting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    issuesApi.getAiRouting(issueId)
      .then((response) => {
        if (mounted) setRouting(response.analysis);
      })
      .catch(() => {
        if (mounted) setRouting(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [issueId]);

  const recommendation = routing?.recommendation;
  return (
    <section className="p-6 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <IconLayers size={16} className="text-cyan-300" />
          <span>AI Smart Routing</span>
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-cyan-300 border border-cyan-500/30 rounded-full px-2 py-1">
          AI-assisted recommendation
        </span>
      </div>

      {loading && <p className="text-xs text-slate-400">Checking routing status…</p>}
      {!loading && !routing && <p className="text-xs text-slate-400">AI routing unavailable — using standard routing.</p>}
      {!loading && routing && (routing.status === 'PENDING' || routing.status === 'PROCESSING') && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <IconClock size={14} className="text-cyan-300" />
          AI routing in progress.
        </p>
      )}
      {!loading && routing?.status === 'FAILED' && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <IconAlertCircle size={14} className="text-amber-300" />
          AI routing unavailable — using standard routing.
        </p>
      )}
      {!loading && routing?.status === 'COMPLETED' && recommendation && (
        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Recommended department</span>
            <span className="font-semibold text-cyan-200">{recommendation.departmentName}</span>
          </div>
          <p><span className="text-slate-500">Reason:</span> {recommendation.reason}</p>
          <p><span className="text-slate-500">Routing signals:</span> {recommendation.signals.join(', ') || 'None provided'}</p>
          <p className="text-[11px] text-slate-500">Confidence: {Math.round((routing.confidence ?? recommendation.confidence) * 100)}%</p>
        </div>
      )}
      {!loading && routing?.status === 'FAILED' && routing.recommendation && (
        <p className="text-[11px] text-slate-500">Standard routing recommendation: {routing.recommendation.departmentName}</p>
      )}
    </section>
  );
}
