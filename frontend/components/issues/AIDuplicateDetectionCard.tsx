'use client';

import { useEffect, useState } from 'react';
import { issuesApi } from '@/lib/api';
import { IssueDuplicateAnalysis } from '@/types';
import { IconAlertCircle, IconClock, IconLayers } from '@/components/ui/Icons';

export function AIDuplicateDetectionCard({ issueId }: { issueId: string }) {
  const [analysis, setAnalysis] = useState<IssueDuplicateAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    issuesApi.getDuplicateAnalysis(issueId)
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

  const assessment = analysis?.assessment;
  return (
    <section className="p-6 rounded-2xl border border-violet-500/20 bg-violet-950/20 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <IconLayers size={16} className="text-violet-300" />
          <span>AI-assisted Duplicate Detection</span>
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-violet-300 border border-violet-500/30 rounded-full px-2 py-1">
          Advisory only
        </span>
      </div>

      {loading && <p className="text-xs text-slate-400">Checking duplicate analysis status…</p>}
      {!loading && !analysis && (
        <p className="text-xs text-slate-400">Duplicate analysis unavailable.</p>
      )}
      {!loading && analysis && (analysis.status === 'PENDING' || analysis.status === 'PROCESSING') && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <IconClock size={14} className="text-violet-300" />
          Duplicate analysis in progress.
        </p>
      )}
      {!loading && analysis?.status === 'FAILED' && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <IconAlertCircle size={14} className="text-amber-300" />
          Duplicate analysis unavailable.
        </p>
      )}
      {!loading && analysis?.status === 'COMPLETED' && assessment && (
        assessment.isDuplicate ? (
          <div className="space-y-3 text-xs text-slate-300">
            <p className="font-semibold text-violet-200">Possible duplicate issue</p>
            {assessment.matchedIssueReference && (
              <p><span className="text-slate-500">Matched issue:</span> {assessment.matchedIssueReference}</p>
            )}
            <p><span className="text-slate-500">Reason:</span> {assessment.reason}</p>
            <p><span className="text-slate-500">Similarity signals:</span> {assessment.similaritySignals.join(', ') || 'None provided'}</p>
            <p className="text-[11px] text-slate-500">Confidence: {Math.round((analysis.confidence ?? assessment.confidence) * 100)}%</p>
          </div>
        ) : (
          <p className="text-xs text-slate-300">No likely duplicate detected.</p>
        )
      )}
    </section>
  );
}
