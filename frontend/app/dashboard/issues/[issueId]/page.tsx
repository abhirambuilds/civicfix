'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { issuesApi } from '@/lib/api';
import { Issue, IssueComment, IssueImage, IssueStatusHistory } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { IssueTimeline } from '@/components/issues/IssueTimeline';
import { ImagePreviewModal } from '@/components/issues/ImagePreviewModal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  IconChevronLeft,
  IconMapPin,
  IconCalendar,
  IconTag,
  IconImage,
  IconMessageSquare,
  IconCheckCircle,
  IconAlertCircle,
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

  const refreshDetails = useCallback(async () => {
    if (!issueId) return;
    setIsLoading(true);
    setError(null);

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
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to load issue details. You may not have access to this ticket.';
      setError(msg);
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
          const msg =
            err instanceof Error
              ? err.message
              : 'Failed to load issue details. You may not have access to this ticket.';
          setError(msg);
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="p-8 rounded-2xl border border-rose-900/60 bg-rose-950/30 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <IconAlertCircle size={24} />
        </div>
        <h3 className="text-lg font-bold text-white">Access Denied or Not Found</h3>
        <p className="text-xs text-rose-300">
          {error || 'The requested issue could not be found or you do not have permission to view it.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={refreshDetails}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Retry
          </button>
          <Link
            href="/dashboard/issues"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            <IconChevronLeft size={16} />
            <span>Return to My Issues</span>
          </Link>
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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
        <Link
          href="/dashboard"
          className="hover:text-slate-200 transition-colors"
        >
          Dashboard
        </Link>
        <span>/</span>
        <Link
          href="/dashboard/issues"
          className="hover:text-slate-200 transition-colors"
        >
          My Issues
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-mono font-medium">
          {issue.issueNumber}
        </span>
      </nav>

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

        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
          {issue.title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <span className="inline-flex items-center gap-1.5">
            <IconCalendar size={14} className="text-slate-400" />
            <span>Reported on {new Date(issue.createdAt).toLocaleString()}</span>
          </span>

          {issue.organization && (
            <span className="inline-flex items-center gap-1.5 text-indigo-300">
              <IconSparkles size={14} />
              <span>Handling Org: {issue.organization.name}</span>
            </span>
          )}
        </div>
      </div>

      {/* Two Column Layout: Main Details vs Timeline & Meta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Official Resolution Card (Displayed when resolved or closed) */}
          {isResolvedOrClosed && (
            <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-200 space-y-3 shadow-md">
              <div className="flex items-center gap-2">
                <IconCheckCircle size={20} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Issue Successfully Resolved
                </h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {issue.resolvedAt
                  ? `Officially marked as resolved on ${new Date(issue.resolvedAt).toLocaleString()}.`
                  : 'Resolution work completed by campus facilities team.'}
              </p>
              {resolutionEvent?.remark && (
                <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-500/20 text-xs text-emerald-100">
                  <span className="font-semibold text-emerald-300">Public Resolution Note: </span>
                  <span>&ldquo;{resolutionEvent.remark}&rdquo;</span>
                </div>
              )}
            </div>
          )}

          {/* Description Card */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Issue Description
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {issue.description}
            </p>
          </div>

          {/* Attached Photo Evidence */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <IconImage size={15} className="text-sky-400" />
                <span>Photo Evidence ({images.length})</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Stored in private Supabase Storage
              </span>
            </div>

            {images.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-slate-800 text-center text-xs text-slate-400">
                No photographs were attached to this report.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img)}
                    className="group relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 text-[10px] text-white">
                      Click to expand
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Public Citizen & Official Activity Comments */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <IconMessageSquare size={15} className="text-emerald-400" />
              <span>Public Activity &amp; Discussion</span>
            </h3>

            {/* Existing Comments */}
            <div className="space-y-3">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No public remarks have been logged yet for this report.
                </p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">
                        {comment.author?.name || 'Department Official'}
                        {comment.author?.role && (
                          <span className="ml-1.5 text-[10px] font-normal text-slate-400">
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

            {/* Add Comment Form */}
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
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmittingComment}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors shrink-0"
                >
                  {isSubmittingComment ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right / Sidebar Column */}
        <div className="space-y-6">
          {/* Status Lifecycle Timeline */}
          <IssueTimeline
            currentStatus={issue.status}
            statusHistory={statusHistory}
            createdAt={issue.createdAt}
          />

          {/* Location Information */}
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <IconMapPin size={15} className="text-rose-400" />
              <span>Location Details</span>
            </h3>

            <div className="space-y-2 text-xs">
              {issue.location?.landmark && (
                <div>
                  <span className="text-slate-400 block text-[10px]">Landmark</span>
                  <span className="text-slate-200 font-medium">{issue.location.landmark}</span>
                </div>
              )}

              {issue.location?.address && (
                <div>
                  <span className="text-slate-400 block text-[10px]">Address</span>
                  <span className="text-slate-300">{issue.location.address}</span>
                </div>
              )}

              {issue.location?.latitude && issue.location?.longitude && (
                <div>
                  <span className="text-slate-400 block text-[10px]">GPS Coordinates</span>
                  <span className="font-mono text-slate-300">
                    {issue.location.latitude.toFixed(6)}, {issue.location.longitude.toFixed(6)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Department Assignment Info */}
          {issue.assignments && issue.assignments.length > 0 && (
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Department Assignment
              </h3>
              <div className="text-xs space-y-1">
                <span className="text-indigo-300 font-semibold block">
                  {issue.assignments[0].department?.name || 'Department Assigned'}
                </span>
                {issue.assignments[0].assignedUser?.name && (
                  <span className="text-slate-400 text-[11px] block">
                    Lead Tech: {issue.assignments[0].assignedUser.name}
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
