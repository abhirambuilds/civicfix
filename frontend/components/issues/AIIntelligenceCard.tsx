'use client';

import { useEffect, useState } from 'react';
import { issuesApi } from '@/lib/api';
import { IssueAiAnalysis } from '@/types';
import { IconAlertCircle, IconClock, IconShield } from '@/components/ui/Icons';

function levelClass(level: string): string {
  if (level === 'CRITICAL') return 'text-rose-300';
  if (level === 'HIGH') return 'text-orange-300';
  if (level === 'MEDIUM') return 'text-amber-300';
  return 'text-emerald-300';
}

export function AIIntelligenceCard({ issueId }: { issueId: string }) {
  const [analysis, setAnalysis] = useState<IssueAiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    issuesApi.getAiAnalysis(issueId)
      .then((response) => {
        if (mounted) setAnalysis(response.analysis);
      })
      .catch(() => {
        if (mounted) setAnalysis(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [issueId]);

  const result = analysis?.structuredResult;
  return (
    <section className="p-6 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <IconShield size={16} className="text-indigo-300" />
          <span>AI-assisted Issue Intelligence</span>
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-indigo-300 border border-indigo-500/30 rounded-full px-2 py-1">
          Advisory
        </span>
      </div>

      {loading && <p className="text-xs text-slate-400">Checking analysis status…</p>}
      {!loading && !analysis && (
        <p className="text-xs text-slate-400">No AI analysis is available for this issue yet.</p>
      )}
      {!loading && analysis && (analysis.status === 'PENDING' || analysis.status === 'PROCESSING') && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <IconClock size={14} className="text-indigo-300" />
          AI analysis is in progress. Refresh this page shortly.
        </p>
      )}
      {!loading && analysis?.status === 'FAILED' && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <IconAlertCircle size={14} className="text-amber-300" />
          AI analysis is currently unavailable; the issue workflow is unaffected.
        </p>
      )}
      {!loading && analysis?.status === 'COMPLETED' && result && (
        <div className="space-y-3 text-xs text-slate-300">
          <p><span className="text-slate-500">Normalized title:</span> {result.normalizedTitle}</p>
          <p className="leading-relaxed">{result.summary}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Severity', result.severity],
              ['Urgency', result.urgency],
              ['Impact', result.impact],
              ['Suggested priority', result.suggestedPriority],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
                <div className={`mt-1 font-semibold ${levelClass(value)}`}>{value}</div>
              </div>
            ))}
          </div>
          <p><span className="text-slate-500">Type:</span> {result.issueType}</p>
          <p><span className="text-slate-500">Keywords:</span> {result.keywords.join(', ')}</p>
          <p><span className="text-slate-500">Recommended action:</span> {result.recommendedAction}</p>
          {!result.descriptionSufficient && result.clarificationQuestion && (
            <p className="text-amber-200"><span className="text-amber-300">Clarification:</span> {result.clarificationQuestion}</p>
          )}
          <p className="text-[11px] text-slate-500">Confidence: {Math.round((analysis.confidence || result.confidence) * 100)}%</p>
        </div>
      )}
    </section>
  );
}
