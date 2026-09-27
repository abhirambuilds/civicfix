'use client';

import React, { useState } from 'react';
import {
  Issue,
  IssueAssignment,
  IssueStatus,
  IssuePriority,
  OrganizationDepartmentSummary,
  DepartmentMemberSummary,
  UserRole,
} from '@/types';
import { issuesApi, organizationsApi, ApiError } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import {
  IconBuilding,
  IconUser,
  IconClock,
  IconShield,
  IconLayers,
  IconCheckCircle,
  IconAlertCircle,
  IconX,
  IconCheck,
  IconRefresh,
  IconMessageSquare,
  IconArrowRight,
} from '@/components/ui/Icons';

interface OrgIssueWorkflowProps {
  issue: Issue;
  assignments: IssueAssignment[];
  currentUser: {
    id: string;
    role: UserRole;
    name?: string;
  } | null;
  onWorkflowUpdated: () => Promise<void>;
}

// Authorized lifecycle transitions defined by the backend state machine
const VALID_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  REPORTED: ['UNDER_REVIEW', 'ASSIGNED'],
  UNDER_REVIEW: ['ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS', 'UNDER_REVIEW'],
  IN_PROGRESS: ['RESOLVED', 'UNDER_REVIEW'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS', 'UNDER_REVIEW'],
};

const STATUS_LABELS: Record<IssueStatus, string> = {
  REPORTED: 'Reported',
  UNDER_REVIEW: 'Under Review',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const PRIORITY_OPTIONS: IssuePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function OrgIssueWorkflow({
  issue,
  assignments,
  currentUser,
  onWorkflowUpdated,
}: OrgIssueWorkflowProps) {
  const userRole = currentUser?.role;

  // Authorization checks based on existing backend RBAC
  const canAssign =
    userRole === 'ORG_OWNER' || userRole === 'ORG_ADMIN' || userRole === 'MANAGER';
  const canChangePriority =
    userRole === 'ORG_OWNER' || userRole === 'ORG_ADMIN' || userRole === 'MANAGER';
  const canClose =
    userRole === 'ORG_OWNER' || userRole === 'ORG_ADMIN' || userRole === 'MANAGER';
  const canAddRemarks = userRole !== 'USER';

  // Active assignment
  const activeAssignment = assignments.find((a) => a.isActive !== false);

  // Assignment Modal / Form State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [departments, setDepartments] = useState<OrganizationDepartmentSummary[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [deptMembers, setDeptMembers] = useState<DepartmentMemberSummary[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [isLoadingDepts, setIsLoadingDepts] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Status Change State
  const [targetStatus, setTargetStatus] = useState<IssueStatus | null>(null);
  const [statusRemark, setStatusRemark] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Priority Change State
  const [customPriority, setCustomPriority] = useState<IssuePriority | null>(null);
  const selectedPriority = customPriority ?? issue.priority;
  const [priorityRemark, setPriorityRemark] = useState('');
  const [isSubmittingPriority, setIsSubmittingPriority] = useState(false);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [prioritySuccess, setPrioritySuccess] = useState(false);

  // Resolution Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionRemark, setResolutionRemark] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Internal Remark State
  const [remarkText, setRemarkText] = useState('');
  const [isInternalRemark, setIsInternalRemark] = useState(true);
  const [isSubmittingRemark, setIsSubmittingRemark] = useState(false);
  const [remarkError, setRemarkError] = useState<string | null>(null);
  const [remarkSuccess, setRemarkSuccess] = useState(false);

  // Show Assignment History
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Load departments when assign modal opens
  const openAssignModal = async () => {
    setShowAssignModal(true);
    setAssignError(null);
    setSelectedDeptId(activeAssignment?.departmentId || '');
    setSelectedStaffId(activeAssignment?.assignedUserId || '');
    setAssignNotes('');
    setIsLoadingDepts(true);

    try {
      const deptsRes = await organizationsApi.getDepartments();
      const activeDepts = (deptsRes.departments || []).filter((d) => d.isActive !== false);
      setDepartments(activeDepts);

      if (activeAssignment?.departmentId) {
        loadDeptMembers(activeAssignment.departmentId);
      }
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : 'Failed to load organization departments.'
      );
    } finally {
      setIsLoadingDepts(false);
    }
  };

  // Load staff members when department changes
  const loadDeptMembers = async (deptId: string) => {
    if (!deptId) {
      setDeptMembers([]);
      setSelectedStaffId('');
      return;
    }
    setIsLoadingMembers(true);
    try {
      const res = await organizationsApi.getDepartmentMembers(deptId);
      const activeMembers = (res.members || []).filter((m) => m.isActive !== false);
      setDeptMembers(activeMembers);
    } catch {
      setDeptMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleDeptSelect = (deptId: string) => {
    setSelectedDeptId(deptId);
    setSelectedStaffId('');
    loadDeptMembers(deptId);
  };

  // Handle Assignment / Reassignment Submit
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId) {
      setAssignError('Please select a department to assign this issue.');
      return;
    }

    setIsSubmittingAssign(true);
    setAssignError(null);

    try {
      await issuesApi.assign(
        issue.id,
        selectedDeptId,
        selectedStaffId || null,
        assignNotes.trim() || null
      );
      setShowAssignModal(false);
      await onWorkflowUpdated();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setAssignError(err.message);
      } else {
        setAssignError(err instanceof Error ? err.message : 'Failed to assign issue.');
      }
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Compute allowed status transitions for the current user and issue status
  const rawAllowed = VALID_TRANSITIONS[issue.status] || [];
  const allowedTransitions = rawAllowed.filter((status) => {
    // STAFF cannot close issues
    if (status === 'CLOSED' && userRole === 'STAFF') {
      return false;
    }
    return true;
  });

  // Handle Status Change Submit
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus) return;

    setIsSubmittingStatus(true);
    setStatusError(null);

    try {
      await issuesApi.updateStatus(issue.id, targetStatus, statusRemark.trim() || undefined);
      setTargetStatus(null);
      setStatusRemark('');
      await onWorkflowUpdated();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setStatusError(err.message);
      } else {
        setStatusError(err instanceof Error ? err.message : 'Failed to update issue status.');
      }
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Handle Priority Change Submit
  const handlePrioritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPriority === issue.priority) return;

    setIsSubmittingPriority(true);
    setPriorityError(null);
    setPrioritySuccess(false);

    try {
      await issuesApi.updatePriority(
        issue.id,
        selectedPriority,
        priorityRemark.trim() || undefined
      );
      setCustomPriority(null);
      setPriorityRemark('');
      setPrioritySuccess(true);
      setTimeout(() => setPrioritySuccess(false), 3000);
      await onWorkflowUpdated();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPriorityError(err.message);
      } else {
        setPriorityError(err instanceof Error ? err.message : 'Failed to update priority.');
      }
    } finally {
      setIsSubmittingPriority(false);
    }
  };

  // Handle Resolution Submit
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionRemark.trim()) {
      setResolveError('Please provide details on how the issue was resolved.');
      return;
    }

    setIsSubmittingResolve(true);
    setResolveError(null);

    try {
      await issuesApi.resolve(issue.id, resolutionRemark.trim());
      setShowResolveModal(false);
      setResolutionRemark('');
      await onWorkflowUpdated();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setResolveError(err.message);
      } else {
        setResolveError(err instanceof Error ? err.message : 'Failed to resolve issue.');
      }
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // Handle Internal Operational Remark Submit
  const handleRemarkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarkText.trim()) {
      setRemarkError('Remark content cannot be empty.');
      return;
    }

    setIsSubmittingRemark(true);
    setRemarkError(null);
    setRemarkSuccess(false);

    try {
      await issuesApi.addRemark(issue.id, remarkText.trim(), isInternalRemark);
      setRemarkText('');
      setRemarkSuccess(true);
      setTimeout(() => setRemarkSuccess(false), 3000);
      await onWorkflowUpdated();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setRemarkError(err.message);
      } else {
        setRemarkError(err instanceof Error ? err.message : 'Failed to post remark.');
      }
    } finally {
      setIsSubmittingRemark(false);
    }
  };

  const isResolved = issue.status === 'RESOLVED';
  const isClosed = issue.status === 'CLOSED';

  return (
    <div className="space-y-6">
      {/* 1. Header Card: Current Workflow Snapshot */}
      <div className="p-6 rounded-2xl border border-indigo-900/60 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <IconLayers size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Organization Issue Workflow
              </h2>
              <p className="text-xs text-slate-400">
                Authorized state transitions, assignment, and operational controls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">Status:</span>
            <StatusBadge status={issue.status} size="sm" />
          </div>
        </div>

        {/* Resolution Banner if resolved or closed */}
        {(isResolved || isClosed) && (
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isClosed
                ? 'border-purple-500/30 bg-purple-950/20 text-purple-200'
                : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <IconCheckCircle
                size={20}
                className={isClosed ? 'text-purple-400 mt-0.5' : 'text-emerald-400 mt-0.5'}
              />
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-white">
                  {isClosed ? 'Issue Closed and Archived' : 'Issue Marked as Resolved'}
                </p>
                <p className="text-[11px] opacity-90">
                  {isClosed && issue.closedAt
                    ? `Closed at: ${new Date(issue.closedAt).toLocaleString()}`
                    : issue.resolvedAt
                    ? `Resolved at: ${new Date(issue.resolvedAt).toLocaleString()}`
                    : 'Resolution recorded in timeline.'}
                </p>
              </div>
            </div>

            {isResolved && canClose && (
              <button
                type="button"
                onClick={() => setTargetStatus('CLOSED')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow transition-colors"
              >
                <IconCheck size={14} />
                <span>Verify &amp; Close Issue</span>
              </button>
            )}
          </div>
        )}

        {/* Status Transition Controls */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Available Lifecycle Transitions:
            </span>
            <span className="text-[11px] text-slate-400">
              State Machine Authoritative
            </span>
          </div>

          {allowedTransitions.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-1">
              No further automatic transitions available from {STATUS_LABELS[issue.status]}.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {allowedTransitions.map((nextStatus) => {
                const isResolveAction = nextStatus === 'RESOLVED';
                return (
                  <button
                    key={nextStatus}
                    type="button"
                    onClick={() => {
                      if (isResolveAction) {
                        setShowResolveModal(true);
                      } else {
                        setTargetStatus(nextStatus);
                        setStatusRemark('');
                        setStatusError(null);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      nextStatus === 'IN_PROGRESS'
                        ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/40'
                        : nextStatus === 'RESOLVED'
                        ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                        : nextStatus === 'CLOSED'
                        ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/40'
                        : nextStatus === 'ASSIGNED'
                        ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
                        : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    <span>Move to {STATUS_LABELS[nextStatus]}</span>
                    <IconArrowRight size={13} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Department & Staff Assignment Card */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconBuilding size={16} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Department &amp; Staff Assignment</h3>
          </div>

          <div className="flex items-center gap-2">
            {assignments.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                View History ({assignments.length})
              </button>
            )}

            {canAssign && (
              <button
                type="button"
                onClick={openAssignModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
              >
                <span>{activeAssignment ? 'Reassign Issue' : 'Assign Issue'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Current Active Assignment Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1">
            <span className="text-[11px] text-slate-400 block font-medium">
              Assigned Department
            </span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="font-semibold text-slate-200">
                {activeAssignment?.department?.name || 'Unassigned'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-1">
            <span className="text-[11px] text-slate-400 block font-medium">
              Assigned Field Staff
            </span>
            <div className="flex items-center gap-2">
              <IconUser size={13} className="text-slate-400" />
              <span className="font-semibold text-slate-200">
                {activeAssignment?.assignedUser?.name || 'Unassigned (Queue only)'}
              </span>
            </div>
            {activeAssignment?.assignedUser?.email && (
              <span className="text-[10px] text-slate-400 block truncate">
                {activeAssignment.assignedUser.email}
              </span>
            )}
          </div>
        </div>

        {activeAssignment?.notes && (
          <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/40 text-xs text-slate-300">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Assignment Instructions:
            </span>
            <p className="italic">&ldquo;{activeAssignment.notes}&rdquo;</p>
          </div>
        )}
      </div>

      {/* 3. Priority Management Card */}
      {canChangePriority && (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconShield size={16} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Priority Level Management</h3>
            </div>
            <PriorityBadge priority={issue.priority} size="sm" />
          </div>

          <form onSubmit={handlePrioritySubmit} className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIORITY_OPTIONS.map((p) => {
                const isSelected = selectedPriority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCustomPriority(p)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                      isSelected
                        ? p === 'CRITICAL'
                          ? 'bg-rose-950/80 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                          : p === 'HIGH'
                          ? 'bg-amber-950/80 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                          : p === 'MEDIUM'
                          ? 'bg-blue-950/80 border-blue-500 text-blue-300 ring-1 ring-blue-500'
                          : 'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {selectedPriority !== issue.priority && (
              <div className="space-y-2 pt-2 animate-in fade-in">
                <input
                  type="text"
                  value={priorityRemark}
                  onChange={(e) => setPriorityRemark(e.target.value)}
                  placeholder="Optional audit reason for priority change..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />

                {priorityError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <IconAlertCircle size={13} />
                    <span>{priorityError}</span>
                  </p>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPriority(null);
                      setPriorityRemark('');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPriority}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
                  >
                    {isSubmittingPriority ? (
                      <>
                        <IconRefresh size={13} className="animate-spin" />
                        <span>Saving priority...</span>
                      </>
                    ) : (
                      <span>Save Priority</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {prioritySuccess && (
              <p className="text-xs text-emerald-400 flex items-center gap-1 pt-1">
                <IconCheck size={14} />
                <span>Priority updated successfully.</span>
              </p>
            )}
          </form>
        </div>
      )}

      {/* 4. Internal Operational Remarks Card */}
      {canAddRemarks && (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconMessageSquare size={16} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Add Operational Remark</h3>
            </div>
            <span className="text-[11px] text-amber-300/80 font-medium">
              Staff &amp; Officials Only
            </span>
          </div>

          <form onSubmit={handleRemarkSubmit} className="space-y-3">
            {/* Visibility Toggle */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs w-fit">
              <button
                type="button"
                onClick={() => setIsInternalRemark(true)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  isInternalRemark
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Internal Technical Remark (Hidden from Citizen)
              </button>
              <button
                type="button"
                onClick={() => setIsInternalRemark(false)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  !isInternalRemark
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Public Citizen Comment
              </button>
            </div>

            <textarea
              rows={3}
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder={
                isInternalRemark
                  ? 'Add internal operational note (e.g., Replacement breaker ordered; Field team dispatched tomorrow morning...)'
                  : 'Add public response visible to the reporting student/citizen...'
              }
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
            />

            {remarkError && (
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <IconAlertCircle size={13} />
                <span>{remarkError}</span>
              </p>
            )}

            {remarkSuccess && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <IconCheck size={14} />
                <span>Remark recorded successfully.</span>
              </p>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[11px] text-slate-500">
                {isInternalRemark
                  ? 'Protected by backend role isolation.'
                  : 'Citizen will see this in their tracking timeline.'}
              </span>
              <button
                type="submit"
                disabled={isSubmittingRemark || !remarkText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors shadow-sm"
              >
                {isSubmittingRemark ? (
                  <>
                    <IconRefresh size={13} className="animate-spin" />
                    <span>Adding remark...</span>
                  </>
                ) : (
                  <span>{isInternalRemark ? 'Add Internal Remark' : 'Post Comment'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Department & Staff Assignment Dialog */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <IconBuilding size={16} className="text-indigo-400" />
                <h4 className="text-sm font-bold text-white">
                  {activeAssignment ? 'Reassign Civic Issue' : 'Assign Civic Issue'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-5 space-y-4 text-xs">
              {activeAssignment && (
                <div className="p-3 rounded-xl border border-indigo-900/50 bg-indigo-950/20 text-indigo-300">
                  <span className="font-semibold block text-[11px]">Current Assignment:</span>
                  <span>
                    {activeAssignment.department?.name || 'Department'} &bull;{' '}
                    {activeAssignment.assignedUser?.name || 'Unassigned Staff'}
                  </span>
                </div>
              )}

              {/* Department Selector */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">
                  Department <span className="text-rose-400">*</span>
                </label>
                {isLoadingDepts ? (
                  <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-400">
                    Loading departments...
                  </div>
                ) : (
                  <select
                    value={selectedDeptId}
                    onChange={(e) => handleDeptSelect(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Select Active Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.code ? `(${d.code})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Staff Technician Selector */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">
                  Assigned Staff Technician <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                {isLoadingMembers ? (
                  <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-400">
                    Loading department staff...
                  </div>
                ) : (
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    disabled={!selectedDeptId}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    <option value="">-- Unassigned (Department Queue) --</option>
                    {deptMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.name} ({m.user.email}) - {m.roleInDepartment}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Notes / Instructions */}
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">
                  Assignment Instructions / Reason
                </label>
                <textarea
                  rows={3}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g. Assigned to Electrical team for immediate generator circuit inspection..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {assignError && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 flex items-center gap-2">
                  <IconAlertCircle size={16} className="text-rose-400 shrink-0" />
                  <span>{assignError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  disabled={isSubmittingAssign}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssign || !selectedDeptId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 shadow-sm"
                >
                  {isSubmittingAssign ? (
                    <>
                      <IconRefresh size={14} className="animate-spin" />
                      <span>Assigning issue...</span>
                    </>
                  ) : (
                    <span>Confirm Assignment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Consequential Status Change Confirmation Dialog */}
      {/* ========================================================================= */}
      {targetStatus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <IconClock size={16} className="text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Confirm Status Transition</h4>
              </div>
              <button
                type="button"
                onClick={() => setTargetStatus(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                <p className="text-slate-300">
                  Transition this issue from{' '}
                  <span className="font-bold text-white">{STATUS_LABELS[issue.status]}</span> to{' '}
                  <span className="font-bold text-indigo-300">{STATUS_LABELS[targetStatus]}</span>?
                </p>
                <p className="text-[11px] text-slate-400">
                  This update will be recorded authoritatively in the issue audit timeline.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">
                  Status Transition Remark <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={statusRemark}
                  onChange={(e) => setStatusRemark(e.target.value)}
                  placeholder={`Reason for moving to ${STATUS_LABELS[targetStatus]}...`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {statusError && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 flex items-center gap-2">
                  <IconAlertCircle size={16} className="text-rose-400 shrink-0" />
                  <span>{statusError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTargetStatus(null)}
                  disabled={isSubmittingStatus}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStatus}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 shadow-sm"
                >
                  {isSubmittingStatus ? (
                    <>
                      <IconRefresh size={14} className="animate-spin" />
                      <span>Updating status...</span>
                    </>
                  ) : (
                    <span>Confirm Transition</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Issue Resolution Dialog */}
      {/* ========================================================================= */}
      {showResolveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2 text-emerald-400">
                <IconCheckCircle size={18} />
                <h4 className="text-sm font-bold text-white">Resolve Civic Issue</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl border border-emerald-950/60 bg-emerald-950/20 text-emerald-200 space-y-1">
                <p className="font-semibold text-white">Marking issue as RESOLVED</p>
                <p className="text-[11px] text-emerald-300/80">
                  The backend will record the resolution timestamp and display this verification note to the citizen.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">
                  Resolution Summary / Repair Notes <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={resolutionRemark}
                  onChange={(e) => setResolutionRemark(e.target.value)}
                  required
                  placeholder="Describe how the issue was fixed (e.g., Damaged electrical relay replaced and circuit breaker test completed successfully)..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                />
              </div>

              {resolveError && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 flex items-center gap-2">
                  <IconAlertCircle size={16} className="text-rose-400 shrink-0" />
                  <span>{resolveError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  disabled={isSubmittingResolve}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolve || !resolutionRemark.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 shadow-sm"
                >
                  {isSubmittingResolve ? (
                    <>
                      <IconRefresh size={14} className="animate-spin" />
                      <span>Resolving issue...</span>
                    </>
                  ) : (
                    <span>Confirm Resolution</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Assignment History Dialog */}
      {/* ========================================================================= */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-lg w-full max-h-[80vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <IconClock size={16} className="text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Assignment Audit History</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-xs">
              {assignments.length === 0 ? (
                <p className="text-slate-400 text-center py-6">No assignment history recorded.</p>
              ) : (
                assignments.map((asgn) => (
                  <div
                    key={asgn.id}
                    className={`p-3.5 rounded-xl border space-y-1.5 ${
                      asgn.isActive !== false
                        ? 'border-indigo-500/40 bg-indigo-950/20 text-slate-200'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <span>{asgn.department?.name || 'Department'}</span>
                        {asgn.isActive !== false ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
                            Active
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                            Previous
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {asgn.createdAt ? new Date(asgn.createdAt).toLocaleString() : ''}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300">
                      Staff: {asgn.assignedUser?.name || 'Unassigned / Queue'}
                    </div>

                    {asgn.notes && (
                      <div className="text-[11px] italic text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                        &ldquo;{asgn.notes}&rdquo;
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
