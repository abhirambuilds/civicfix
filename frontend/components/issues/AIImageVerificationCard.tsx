'use client';

import { useEffect, useState } from 'react';
import { issuesApi } from '@/lib/api';
import { IssueImageVerification } from '@/types';
import { IconAlertCircle, IconClock, IconImage } from '@/components/ui/Icons';

export function AIImageVerificationCard({ issueId }: { issueId: string }) {
  const [analysis, setAnalysis] = useState<IssueImageVerification | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    issuesApi.getImageVerification(issueId).then((response) => { if (mounted) setAnalysis(response.analysis); }).catch(() => { if (mounted) setAnalysis(null); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [issueId]);

  const assessment = analysis?.assessment;
  return (
    <section className="p-6 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><IconImage size={16} className="text-cyan-300" /><span>AI Image Verification</span></h2>
        <span className="text-[10px] uppercase tracking-wider text-cyan-300 border border-cyan-500/30 rounded-full px-2 py-1">AI-assisted · Advisory only</span>
      </div>
      {loading && <p className="text-xs text-slate-400">Image verification in progress…</p>}
      {!loading && !analysis && <p className="text-xs text-slate-400">AI image verification unavailable.</p>}
      {!loading && analysis && (analysis.status === 'PENDING' || analysis.status === 'PROCESSING') && <p className="text-xs text-slate-400 flex items-center gap-2"><IconClock size={14} className="text-cyan-300" />Image verification in progress.</p>}
      {!loading && analysis?.status === 'FAILED' && <p className="text-xs text-slate-400 flex items-center gap-2"><IconAlertCircle size={14} className="text-amber-300" />AI image verification unavailable.</p>}
      {!loading && analysis?.status === 'COMPLETED' && assessment && (
        <div className="space-y-3 text-xs text-slate-300">
          <p className="font-semibold text-cyan-200">{assessment.isRelevant === 'RELEVANT' ? 'Image appears relevant' : assessment.isRelevant === 'NOT_RELEVANT' ? 'Image may not match the reported issue' : 'Image relevance is uncertain'}</p>
          <p><span className="text-slate-500">Detected issue type:</span> {assessment.detectedIssueType}</p>
          <p><span className="text-slate-500">Visual summary:</span> {assessment.visualSummary}</p>
          <p><span className="text-slate-500">Evidence:</span> {assessment.evidence.join(', ') || 'None provided'}</p>
          {assessment.concerns.length > 0 && <p><span className="text-slate-500">Concerns:</span> {assessment.concerns.join(', ')}</p>}
          <p className="text-[11px] text-slate-500">Confidence: {Math.round((analysis.confidence ?? assessment.confidence) * 100)}%</p>
        </div>
      )}
    </section>
  );
}
