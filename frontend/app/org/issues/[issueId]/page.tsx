'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { issuesApi, ApiError } from '@/lib/api';
import {
  Issue,
  IssueComment,
  IssueImage,
  IssueStatusHistory,
  IssueAssignment,
} from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { ImagePreviewModal } from '@/components/issues/ImagePreviewModal';
import { OrgIssueWorkflow } from '@/components/issues/OrgIssueWorkflow';
import { LocationPicker } from '@/components/map/LocationPicker';
import { AIIntelligenceCard } from '@/components/issues/AIIntelligenceCard';
import { AISmartRoutingCard } from '@/components/issues/AISmartRoutingCard';
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
  IconBuilding,
  IconShield,
  IconUsers,
  IconUser,
  IconFileText,
  IconChevronRight,
} from '@/components/ui/Icons';

function formatRoleLabel(role?: string): string {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return 'Platform Superadmin';
    case 'ORG_OWNER':
      return 'Organization Owner';
    case 'ORG_ADMIN':
      return 'Organization Admin';
    case 'MANAGER':
      return 'Department Manager';
    case 'STAFF':
      return 'Field Technician / Staff';
    case 'USER':
      return 'Citizen / Student';
    default:
      return role || 'Official';
  }
}

export default function OrgIssueDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params.issueId as string;
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [images, setImages] = useState<IssueImage[]>([]);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [statusHistory, setStatusHistory] = useState<IssueStatusHistory[]>([]);
  const [assignments, setAssignments] = useState<IssueAssignment[]>([]);
  const [selectedImage, setSelectedImage] = useState<IssueImage | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // Authentication check
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    if (!issueId || user?.role === 'USER') return;
    setIsRefreshing(true);
    try {
      const issueData = await issuesApi.getById(issueId);
      setIssue(issueData);

      const [imagesRes, commentsRes, historyRes, assignmentsRes] = await Promise.allSettled([
        issuesApi.getImages(issueId),
        issuesApi.getComments(issueId),
        issuesApi.getStatusHistory(issueId),
        issuesApi.getAssignments(issueId),
      ]);

      if (imagesRes.status === 'fulfilled') {
        setImages(imagesRes.value || []);
      }
      if (commentsRes.status === 'fulfilled') {
        setComments(commentsRes.value || []);
      }
      if (historyRes.status === 'fulfilled') {
        setStatusHistory(historyRes.value || []);
      }
      if (assignmentsRes.status === 'fulfilled') {
        setAssignments(assignmentsRes.value || []);
      } else {
        setAssignments(issueData.assignments || []);
      }
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorStatus(err.statusCode);
        setError(err.message);
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to retrieve issue details.';
        setError(msg);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [issueId, user?.role]);

  // Load issue data on mount or issueId change
  useEffect(() => {
    if (!issueId || user?.role === 'USER') return;

    let isMounted = true;
    async function load() {
      try {
        const issueData = await issuesApi.getById(issueId);

        if (!isMounted) return;
        setIssue(issueData);

        const [imagesRes, commentsRes, historyRes, assignmentsRes] = await Promise.allSettled([
          issuesApi.getImages(issueId),
          issuesApi.getComments(issueId),
          issuesApi.getStatusHistory(issueId),
          issuesApi.getAssignments(issueId),
        ]);

        if (!isMounted) return;

        if (imagesRes.status === 'fulfilled') {
          setImages(imagesRes.value || []);
        } else {
          setImages(issueData.images || []);
        }

        if (commentsRes.status === 'fulfilled') {
          setComments(commentsRes.value || []);
        } else {
          setComments(issueData.comments || []);
        }

        if (historyRes.status === 'fulfilled') {
          setStatusHistory(historyRes.value || issueData.statusHistory || []);
        } else {
          setStatusHistory(issueData.statusHistory || []);
        }

        if (assignmentsRes.status === 'fulfilled') {
          setAssignments(assignmentsRes.value || []);
        } else {
          setAssignments(issueData.assignments || []);
        }

        setError(null);
        setIsLoading(false);
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setErrorStatus(err.statusCode);
          setError(err.message);
        } else {
          const msg =
            err instanceof Error
              ? err.message
              : 'Unable to retrieve issue details.';
          setError(msg);
        }
        setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [issueId, user?.role]);

  // Access control view for normal citizen users
  if (!isAuthLoading && user?.role === 'USER') {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
        <div className="p-8 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-900/40 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
            <IconShield size={28} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Access Restricted: Organization Issue Management
          </h2>
          <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            Administrative issue inspection is reserved for campus organization personnel.
            Students and citizens can track their reported issues via the citizen portal.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/issues"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-150"
            >
              <span>View In Citizen Tracker</span>
              <IconChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="space-y-6 pb-12">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Skeleton className="h-6 w-36 rounded" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-28 rounded" />
            <Skeleton className="h-6 w-20 rounded" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
          <Skeleton className="h-8 w-2/3 rounded" />
          <Skeleton className="h-4 w-1/3 rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
          <div className="lg:col-span-5 space-y-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error View
  if (error || !issue) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/60 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
            <IconAlertCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {errorStatus === 404
              ? 'Issue Not Found'
              : errorStatus === 403
              ? 'Access Denied'
              : 'Unable to Load Issue'}
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            {error || 'The requested issue could not be loaded or you do not have permission to view it.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              Try Again
            </button>
            <Link
              href="/org/issues"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
            >
              Back to Issue Management
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeAssignment = assignments.find((a) => a.isActive !== false);
  const departmentName = activeAssignment?.department?.name || 'Not assigned';
  const assignedStaffName = activeAssignment?.assignedUser?.name || 'Not assigned';
  const assignedStaffEmail = activeAssignment?.assignedUser?.email;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb Navigation & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/org/issues"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-indigo-300 font-medium transition-colors"
          >
            <IconChevronLeft size={16} />
            <span>Issue Management</span>
          </Link>
          <span className="text-slate-600">/</span>
          <span className="font-mono text-indigo-300 font-semibold">
            {issue.issueNumber}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
          >
            <IconRefresh
              size={13}
              className={`text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>
          <Link
            href="/org/issues"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
          >
            <span>All Issues</span>
          </Link>
        </div>
      </div>

      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-md shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-800 text-indigo-300 border border-slate-700">
              {issue.issueNumber}
            </span>
            <PriorityBadge priority={issue.priority} size="md" />
            {issue.category && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                <IconTag size={13} className="text-indigo-400" />
                <span>{issue.category.name}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-900/60">
              <IconBuilding size={13} className="text-indigo-400" />
              <span>Dept: {departmentName}</span>
            </span>
          </div>

          <StatusBadge status={issue.status} size="lg" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
          {issue.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <span className="inline-flex items-center gap-1.5">
            <IconCalendar size={14} className="text-slate-400" />
            <span>Reported: {new Date(issue.createdAt).toLocaleString()}</span>
          </span>

          {issue.organization && (
            <span className="inline-flex items-center gap-1.5 text-indigo-300">
              <IconBuilding size={14} />
              <span>Organization: {issue.organization.name}</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 text-emerald-400">
            <IconShield size={14} />
            <span>Viewer Authority: {formatRoleLabel(user?.role)}</span>
          </span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Full Description, Photos, Assignment Info, Reporter Info, Activity */}
        <div className="lg:col-span-7 space-y-6">
          {/* Issue Description Card */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <IconFileText size={16} className="text-indigo-400" />
              <span>Issue Description</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {issue.description}
            </p>
          </div>

          <AIIntelligenceCard issueId={issue.id} />
          <AISmartRoutingCard issueId={issue.id} />

          {/* Attached Photos Gallery */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <IconImage size={16} className="text-indigo-400" />
                <span>Attached Photos</span>
              </h2>
              <span className="text-xs text-slate-400">
                {images.length} {images.length === 1 ? 'photo' : 'photos'}
              </span>
            </div>

            {images.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400 space-y-1">
                <IconImage size={24} className="mx-auto text-slate-400 mb-2" />
                <p>No photos attached.</p>
                <p className="text-[11px] text-slate-400">
                  Citizen reporter did not upload photographic evidence.
                </p>
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
                        alt={img.fileName || 'Issue attachment photo'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        Attachment
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

          {/* Assignment Information Card */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <IconUsers size={16} className="text-indigo-400" />
              <span>Assignment Information</span>
            </h2>

            {activeAssignment ? (
              <div className="p-4 rounded-xl border border-indigo-900/40 bg-indigo-950/20 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Department
                    </span>
                    <span className="text-slate-100 font-bold">
                      {activeAssignment.department?.name || 'Department Assigned'}
                    </span>
                    {activeAssignment.department?.code && (
                      <span className="ml-1 text-[11px] font-mono text-indigo-300">
                        ({activeAssignment.department.code})
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Assigned Field Staff
                    </span>
                    <span className="text-slate-100 font-bold">
                      {assignedStaffName}
                    </span>
                    {assignedStaffEmail && (
                      <span className="block text-[11px] text-slate-400 font-mono">
                        {assignedStaffEmail}
                      </span>
                    )}
                  </div>
                </div>

                {activeAssignment.notes && (
                  <div className="pt-2 border-t border-indigo-900/40 text-xs">
                    <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider block">
                      Assignment Notes
                    </span>
                    <p className="text-slate-300 mt-0.5">{activeAssignment.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Not assigned</p>
                <p className="text-[11px]">
                  This issue has not been routed to an operations department or technician.
                </p>
              </div>
            )}
          </div>

          {/* Reporter Information (Safe Fields Only) */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <IconUser size={16} className="text-indigo-400" />
              <span>Reporter Information</span>
            </h2>

            {issue.reporter ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-slate-800/80 bg-slate-950/60 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Name
                  </span>
                  <span className="text-slate-200 font-medium">{issue.reporter.name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Contact Email
                  </span>
                  <span className="text-slate-300 font-mono text-[11px]">{issue.reporter.email}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Account Role
                  </span>
                  <span className="text-indigo-300 font-medium">
                    {formatRoleLabel(issue.reporter.role)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Reporter information unavailable.</p>
            )}
          </div>

          {/* Public Discussion & Internal Remarks */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <IconMessageSquare size={16} className="text-indigo-400" />
                <span>Comments &amp; Operational Remarks</span>
              </h2>
              <span className="text-xs text-slate-400">
                {comments.length} {comments.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {comments.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400">
                No activity remarks recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      comment.isInternal
                        ? 'border-amber-500/30 bg-amber-950/20 text-amber-200'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">
                          {comment.author?.name || 'Staff Member'}
                        </span>
                        {comment.isInternal ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Internal Staff Note
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                            Public
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                      {comment.commentText}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Operational Action Area, Status History, Location Map */}
        <div className="lg:col-span-5 space-y-6">
          {/* Operational Workflow Panel (Prompt 18) */}
          <OrgIssueWorkflow
            issue={issue}
            assignments={assignments}
            currentUser={user}
            onWorkflowUpdated={handleManualRefresh}
          />

          {/* Status History Audit Trail */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <IconClock size={16} className="text-indigo-400" />
              <span>Status Transition History</span>
            </h2>

            {statusHistory.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 text-xs text-slate-400 text-center">
                No status history available.
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {statusHistory.map((item, idx) => (
                  <div key={item.id || idx} className="relative pl-7 space-y-1 text-xs">
                    <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-950 transform -translate-x-1/2" />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.previousStatus && (
                        <>
                          <StatusBadge status={item.previousStatus} size="sm" />
                          <span className="text-slate-400 font-bold">→</span>
                        </>
                      )}
                      <StatusBadge status={item.newStatus} size="sm" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      {item.changedBy && (
                        <span className="text-indigo-300 font-medium">
                          by {item.changedBy.name}
                        </span>
                      )}
                    </div>
                    {item.remark && (
                      <p className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800 mt-1">
                        &ldquo;{item.remark}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Read-Only Location Map */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <IconMapPin size={16} className="text-rose-400" />
              <span>Reported Location</span>
            </h2>

            {issue.location &&
            typeof issue.location.latitude === 'number' &&
            typeof issue.location.longitude === 'number' ? (
              <LocationPicker
                value={{
                  latitude: issue.location.latitude,
                  longitude: issue.location.longitude,
                }}
                readOnly={true}
                height="h-[240px]"
              />
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-slate-800 text-xs text-slate-400 text-center">
                Location coordinates unavailable.
              </div>
            )}

            {/* Location Address Details */}
            <div className="space-y-2 text-xs pt-1">
              {issue.location?.landmark && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
                    Landmark
                  </span>
                  <span className="text-slate-200 font-medium">
                    {issue.location.landmark}
                  </span>
                </div>
              )}

              {issue.location?.address && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
                    Address / Zone
                  </span>
                  <span className="text-slate-300">{issue.location.address}</span>
                </div>
              )}

              {issue.location?.latitude && issue.location?.longitude && (
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold uppercase tracking-wider">
                    GPS Coordinates
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {issue.location.latitude.toFixed(6)},{' '}
                    {issue.location.longitude.toFixed(6)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <ImagePreviewModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}
