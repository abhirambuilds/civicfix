'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { issuesApi, ApiError } from '@/lib/api';
import { Issue, IssueComment, IssueImage, IssueStatusHistory } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { IssueTimeline } from '@/components/issues/IssueTimeline';
import { ImagePreviewModal } from '@/components/issues/ImagePreviewModal';
import { LocationPicker } from '@/components/map/LocationPicker';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  IconChevronLeft,
  IconMapPin,
  IconCalendar,
  IconTag,
  IconImage,
  IconMessageSquare,
  IconCheckCircle,
  IconClock,
  IconAlertCircle,
  IconRefresh,
  IconSparkles,
} from '@/components/ui/Icons';

export default function IssueDetailsPage() {
  const params = useParams();
  const issueId = params.issueId as string;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [images, setImages] = useState<IssueImage[]>([]);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [statusHistory, setStatusHistory] = useState<IssueStatusHistory[]>([]);
  const [selectedImage, setSelectedImage] = useState<IssueImage | null>(null);
  const [newComment, setNewComment] = useState<string>('');
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const refreshDetails = useCallback(async () => {
    if (!issueId) return;
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);

    try {
      const issueData = await issuesApi.getById(issueId);
      setIssue(issueData);

      try {
        const imagesData = await issuesApi.getImages(issueId);
        setImages(imagesData || []);
      } catch {
        setImages(issueData.images || []);
      }

      try {
        const commentsData = await issuesApi.getComments(issueId);
        const publicOnly = (commentsData || []).filter((c) => !c.isInternal);
        setComments(publicOnly);
      } catch {
        const fallbackComments = (issueData.comments || []).filter((c) => !c.isInternal);
        setComments(fallbackComments);
      }

      try {
        const historyData = await issuesApi.getStatusHistory(issueId);
        setStatusHistory(historyData || issueData.statusHistory || []);
      } catch {
        setStatusHistory(issueData.statusHistory || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorStatus(err.statusCode);
        setError(err.message);
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to load issue details. You may not have access to this ticket.';
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    if (!issueId) return;
    let isMounted = true;

    async function load() {
      try {
        const issueData = await issuesApi.getById(issueId);
        if (!isMounted) return;
        setIssue(issueData);

        try {
          const imagesData = await issuesApi.getImages(issueId);
          if (isMounted) setImages(imagesData || []);
        } catch {
          if (isMounted) setImages(issueData.images || []);
        }

        try {
          const commentsData = await issuesApi.getComments(issueId);
          if (isMounted) {
            const publicOnly = (commentsData || []).filter((c) => !c.isInternal);
            setComments(publicOnly);
          }
        } catch {
          if (isMounted) {
            const fallbackComments = (issueData.comments || []).filter((c) => !c.isInternal);
            setComments(fallbackComments);
          }
        }

        try {
          const historyData = await issuesApi.getStatusHistory(issueId);
          if (isMounted) {
            setStatusHistory(historyData || issueData.statusHistory || []);
          }
        } catch {
          if (isMounted) {
            setStatusHistory(issueData.statusHistory || []);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          if (err instanceof ApiError) {
            setErrorStatus(err.statusCode);
            setError(err.message);
          } else {
            const msg =
              err instanceof Error
                ? err.message
                : 'Failed to load issue details. You may not have access to this ticket.';
            setError(msg);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [issueId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const added = await issuesApi.addComment(issueId, newComment.trim());
      setComments((prev) => [...prev, added]);
      setNewComment('');
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : 'Unable to post remark. Please try again.'
      );
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error / IDOR Protection / Not Found State
  if (error || !issue) {
    const isForbidden = errorStatus === 403 || error?.toLowerCase().includes('forbidden') || error?.toLowerCase().includes('permission');
    const isNotFound = errorStatus === 404 || error?.toLowerCase().includes('not found');

    return (
      <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 text-center space-y-5 max-w-md mx-auto my-12 shadow-xl backdrop-blur-sm animate-in fade-in">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-md">
          <IconAlertCircle size={28} />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-white">
            {isForbidden
              ? 'Access Denied'
              : isNotFound
              ? 'Issue Not Found'
              : 'Unable to Load Issue'}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isForbidden
              ? 'You do not have permission to view this issue. For privacy and multi-tenant security, citizens can only view reports submitted from their own account.'
              : isNotFound
              ? 'The requested issue ticket could not be found. It may have been archived or deleted.'
              : error || 'An unexpected error occurred while fetching the ticket.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard/issues"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            <IconChevronLeft size={16} />
            <span>Back to My Issues</span>
          </Link>
          <button
            type="button"
            onClick={refreshDetails}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <IconRefresh size={14} />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  const isResolvedOrClosed = issue.status === 'RESOLVED' || issue.status === 'CLOSED';

  // Extract public resolution remark if available
  const resolutionEvent = statusHistory
    .slice()
    .reverse()
    .find((h) => h.newStatus === 'RESOLVED' || h.newStatus === 'CLOSED');

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/dashboard" className="hover:text-slate-200 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/dashboard/issues" className="hover:text-slate-200 transition-colors">
            My Issues
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-mono font-medium">
            {issue.issueNumber}
          </span>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshDetails}
            title="Refresh ticket data"
            aria-label="Refresh ticket data"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <IconRefresh size={14} />
            <span>Refresh</span>
          </button>

          <Link
            href="/dashboard/issues"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors"
          >
            <IconChevronLeft size={14} />
            <span>Back to My Issues</span>
          </Link>
        </div>
      </div>

      {/* Issue Header Banner */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-800 text-indigo-300 border border-slate-700">
              {issue.issueNumber}
            </span>
            <PriorityBadge priority={issue.priority} size="md" />
            {issue.category && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
                <IconTag size={13} className="text-indigo-400" />
                <span>{issue.category.name}</span>
              </span>
            )}
          </div>

          <StatusBadge status={issue.status} size="lg" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
          {issue.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <span className="inline-flex items-center gap-1.5">
            <IconCalendar size={14} className="text-slate-400" />
            <span>Reported on {new Date(issue.createdAt).toLocaleString()}</span>
          </span>

          {issue.organization && (
            <span className="inline-flex items-center gap-1.5 text-indigo-300">
              <IconSparkles size={14} />
              <span>Jurisdiction: {issue.organization.name}</span>
            </span>
          )}
        </div>
      </div>

      {/* Two Column Layout: Main Details vs Timeline & Location */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Resolution, Description, Photos, Comments */}
        <div className="lg:col-span-7 space-y-6">
          {/* Resolution Status Card */}
          {isResolvedOrClosed ? (
            <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-200 space-y-3 shadow-md">
              <div className="flex items-center gap-2">
                <IconCheckCircle size={20} className="text-emerald-400" />
                <h2 className="text-base font-bold text-white">
                  Issue Successfully Resolved
                </h2>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {issue.resolvedAt
                  ? `Officially completed and verified on ${new Date(issue.resolvedAt).toLocaleString()}.`
                  : 'Resolution work completed and signed off by campus maintenance team.'}
              </p>
              {resolutionEvent?.remark && (
                <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-500/20 text-xs text-emerald-100">
                  <span className="font-semibold text-emerald-300">Resolution Remark: </span>
                  <span>&ldquo;{resolutionEvent.remark}&rdquo;</span>
                  {resolutionEvent.changedBy?.name && (
                    <span className="block text-[11px] text-emerald-400/80 mt-1">
                      Verified by: {resolutionEvent.changedBy.name} ({resolutionEvent.changedBy.role})
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconClock size={16} className="text-amber-400" />
                  <h2 className="text-sm font-bold text-white">Resolution Status</h2>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Resolution pending
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                This ticket is actively progressing through our facilities workflow. Official resolution notes and completion timestamps will be recorded here once remediation is inspected.
              </p>
            </div>
          )}

          {/* Issue Description Card */}
          <div className="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Issue Description
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {issue.description}
            </p>
          </div>

          {/* Attached Photo Evidence Card */}
          <div className="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <IconImage size={16} className="text-sky-400" />
                <span>Photo Evidence ({images.length})</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Encrypted in private storage
              </span>
            </div>

            {images.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto">
                  <IconImage size={20} />
                </div>
                <p>No photos attached.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className="group relative aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label={`View photo ${img.fileName || 'attachment'}`}
                  >
                    {img.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.signedUrl}
                        alt={img.fileName || 'Issue attachment thumbnail'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        Preview
                      </div>
                    )}

                    {img.isPrimary && (
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600/90 text-white backdrop-blur-sm shadow flex items-center gap-1">
                        <IconCheckCircle size={10} />
                        <span>Primary</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 text-[10px] text-white">
                      Click to expand
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Public Activity & Discussion Card */}
          <div className="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <IconMessageSquare size={16} className="text-emerald-400" />
              <span>Public Activity &amp; Discussion</span>
            </h2>

            {/* Comments List */}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400">
                  No public comments yet.
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">
                        {comment.author?.name || 'Department Official'}
                        {comment.author?.role && (
                          <span className="ml-1.5 text-[10px] font-normal text-slate-400 font-mono">
                            ({comment.author.role})
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {comment.commentText}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Follow-up Comment Form */}
            <form onSubmit={handleAddComment} className="pt-2 border-t border-slate-800/80 space-y-2">
              <label
                htmlFor="user-comment-input"
                className="block text-xs font-medium text-slate-300"
              >
                Add a citizen follow-up remark
              </label>
              <div className="flex gap-2">
                <input
                  id="user-comment-input"
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Provide additional details or ask a question..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmittingComment}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shrink-0"
                >
                  {isSubmittingComment ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column (5 cols): Timeline, Read-only Location Map, Assignments */}
        <div className="lg:col-span-5 space-y-6">
          {/* Status Lifecycle Timeline */}
          <IssueTimeline
            currentStatus={issue.status}
            statusHistory={statusHistory}
            createdAt={issue.createdAt}
          />

          {/* Read-Only Location Card with OpenStreetMap */}
          <div className="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <IconMapPin size={16} className="text-rose-400" />
              <span>Reported Location</span>
            </h2>

            {/* Interactive Read-Only OpenStreetMap */}
            {issue.location &&
              typeof issue.location.latitude === 'number' &&
              typeof issue.location.longitude === 'number' && (
                <LocationPicker
                  value={{
                    latitude: issue.location.latitude,
                    longitude: issue.location.longitude,
                  }}
                  readOnly={true}
                  height="h-[240px]"
                />
              )}

            {/* Location Text Details */}
            <div className="space-y-2 text-xs pt-1">
              {issue.location?.landmark && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Landmark</span>
                  <span className="text-slate-200 font-medium">{issue.location.landmark}</span>
                </div>
              )}

              {issue.location?.address && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Address / Area</span>
                  <span className="text-slate-300">{issue.location.address}</span>
                </div>
              )}

              {issue.location?.latitude && issue.location?.longitude && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">Coordinates</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {issue.location.latitude.toFixed(6)}, {issue.location.longitude.toFixed(6)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Department Assignment Info */}
          {issue.assignments && issue.assignments.length > 0 && (
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Department Assignment
              </h2>
              <div className="text-xs space-y-1">
                <span className="text-indigo-300 font-semibold block text-sm">
                  {issue.assignments[0].department?.name || 'Department Assigned'}
                </span>
                {issue.assignments[0].assignedUser?.name && (
                  <span className="text-slate-400 text-xs block">
                    Assigned Technician: {issue.assignments[0].assignedUser.name}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}
