'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError, organizationsApi } from '@/lib/api';
import {
  DepartmentMemberSummary,
  ManagedDepartment,
  OrganizationDashboardData,
  OrganizationMemberRole,
  OrganizationMemberSummary,
  UserRole,
} from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconChevronRight,
  IconLogOut,
  IconRefresh,
  IconShield,
  IconUsers,
  IconX,
} from '@/components/ui/Icons';

type Tab = 'departments' | 'staff';
type DepartmentMemberRole = 'MANAGER' | 'STAFF';

interface DepartmentFormState {
  id?: string;
  name: string;
  code: string;
  description: string;
}

interface DepartmentView extends ManagedDepartment {
  managerNames: string[];
  staffCount: number;
  activeIssueCount?: number;
}

interface StaffRow {
  member: OrganizationMemberSummary;
  departments: ManagedDepartment[];
  memberships: DepartmentMemberSummary[];
}

interface ConfirmationState {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
  destructive?: boolean;
}

const ROLE_FILTERS: Array<{ label: string; value: 'ALL' | UserRole }> = [
  { label: 'All roles', value: 'ALL' },
  { label: 'Organization owner', value: 'ORG_OWNER' },
  { label: 'Organization admin', value: 'ORG_ADMIN' },
  { label: 'Manager', value: 'MANAGER' },
  { label: 'Staff', value: 'STAFF' },
];

function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function roleLabel(role?: string): string {
  const labels: Record<string, string> = {
    PLATFORM_ADMIN: 'Platform Admin',
    ORG_OWNER: 'Organization Owner',
    ORG_ADMIN: 'Organization Admin',
    MANAGER: 'Manager',
    STAFF: 'Staff',
    USER: 'User',
    OWNER: 'Owner',
    ADMIN: 'Admin',
    MEMBER: 'Member',
  };
  return labels[role || ''] || role || 'Member';
}

function StatusPill({ active, label }: { active: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        active
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-slate-700 bg-slate-800 text-slate-400'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      {label || (active ? 'Active' : 'Inactive')}
    </span>
  );
}

function Dialog({
  title,
  children,
  onClose,
  width = 'max-w-xl',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} aria-label="Close dialog" />
      <div className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:rounded-2xl ${width}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-4 backdrop-blur">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close dialog">
            <IconX size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function OrganizationDepartmentsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('departments');
  const [dashboard, setDashboard] = useState<OrganizationDashboardData | null>(null);
  const [departments, setDepartments] = useState<ManagedDepartment[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMemberSummary[]>([]);
  const [membersByDepartment, setMembersByDepartment] = useState<Record<string, DepartmentMemberSummary[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState | null>(null);
  const [departmentFormError, setDepartmentFormError] = useState<string | null>(null);
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<ManagedDepartment | null>(null);
  const [selectedDepartmentMembers, setSelectedDepartmentMembers] = useState<DepartmentMemberSummary[]>([]);
  const [selectedDepartmentMembersError, setSelectedDepartmentMembersError] = useState<string | null>(null);
  const [isLoadingDepartment, setIsLoadingDepartment] = useState(false);
  const [addMemberDepartment, setAddMemberDepartment] = useState<ManagedDepartment | null>(null);
  const [newDepartmentMemberId, setNewDepartmentMemberId] = useState('');
  const [newDepartmentMemberRole, setNewDepartmentMemberRole] = useState<DepartmentMemberRole>('STAFF');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const isOrganizationAdministrator =
    user?.role === 'PLATFORM_ADMIN' || user?.role === 'ORG_OWNER' || user?.role === 'ORG_ADMIN';
  const isDepartmentManager = user?.role === 'MANAGER';
  const hasManagementAccess = isOrganizationAdministrator || isDepartmentManager;
  const organizationId = dashboard?.organization.id;

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthLoading, isAuthenticated, router]);

  const loadManagementData = useCallback(
    async (refresh = false) => {
      if (!user || user.role === 'USER' || user.role === 'STAFF') return;

      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const dashboardData = await organizationsApi.getDashboard();
        const orgId = dashboardData.organization.id;
        const departmentResult = await organizationsApi.listManagedDepartments(orgId);
        const memberPromise = isOrganizationAdministrator
          ? organizationsApi.listOrganizationMembers(orgId)
          : Promise.resolve<{ members: OrganizationMemberSummary[] } | null>(null);
        const rosterResults = await Promise.allSettled(
          departmentResult.departments.map((department) =>
            organizationsApi.listManagedDepartmentMembers(orgId, department.id)
          )
        );
        const memberResult = await memberPromise;
        const roster: Record<string, DepartmentMemberSummary[]> = {};

        rosterResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            roster[departmentResult.departments[index].id] = result.value.members || [];
          }
        });

        setDashboard(dashboardData);
        setDepartments(departmentResult.departments || []);
        setOrganizationMembers(memberResult?.members || []);
        setMembersByDepartment(roster);
        setPageError(null);
      } catch (error) {
        setPageError(messageFromError(error, 'Unable to load organization management data.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isOrganizationAdministrator, user]
  );

  useEffect(() => {
    async function fetchManagementData() {
      await loadManagementData();
    }

    if (isAuthenticated && hasManagementAccess) {
      void fetchManagementData();
    }
  }, [hasManagementAccess, isAuthenticated, loadManagementData]);

  const departmentViews = useMemo<DepartmentView[]>(() => {
    const issueCounts = new Map(
      (dashboard?.departments || []).map((department) => [department.id, department.activeIssueCount])
    );

    return departments.map((department) => {
      const roster = membersByDepartment[department.id] || [];
      const activeRoster = roster.filter((member) => member.isActive && member.user.isActive);
      return {
        ...department,
        staffCount: department._count?.members ?? activeRoster.length,
        managerNames: activeRoster
          .filter((member) => member.roleInDepartment.toUpperCase() === 'MANAGER')
          .map((member) => member.user.name),
        activeIssueCount: issueCounts.get(department.id),
      };
    });
  }, [dashboard?.departments, departments, membersByDepartment]);

  const staffRows = useMemo<StaffRow[]>(() => {
    const memberships = Object.values(membersByDepartment).flat();
    const membershipsByUser = new Map<string, DepartmentMemberSummary[]>();
    memberships.forEach((membership) => {
      const existing = membershipsByUser.get(membership.userId) || [];
      existing.push(membership);
      membershipsByUser.set(membership.userId, existing);
    });

    if (organizationMembers.length > 0) {
      return organizationMembers.map((member) => {
        const memberMemberships = membershipsByUser.get(member.userId) || [];
        return {
          member,
          memberships: memberMemberships,
          departments: memberMemberships
            .map((membership) => departments.find((department) => department.id === membership.departmentId))
            .filter((department): department is ManagedDepartment => Boolean(department)),
        };
      });
    }

    // Managers receive only department-scoped roster data from the existing API.
    return Array.from(membershipsByUser.entries()).map(([userId, memberMemberships]) => {
      const source = memberMemberships[0];
      return {
        member: {
          id: source.id,
          organizationId: organizationId || '',
          userId,
          orgRole: source.user.role === 'MANAGER' ? 'MANAGER' : 'STAFF',
          isActive: source.isActive,
          user: source.user,
        },
        memberships: memberMemberships,
        departments: memberMemberships
          .map((membership) => departments.find((department) => department.id === membership.departmentId))
          .filter((department): department is ManagedDepartment => Boolean(department)),
      };
    });
  }, [departments, membersByDepartment, organizationId, organizationMembers]);

  const visibleStaff = useMemo(
    () =>
      staffRows.filter((row) => {
        const effectiveActive = row.member.isActive && row.member.user.isActive;
        const matchesDepartment =
          departmentFilter === 'ALL' || row.departments.some((department) => department.id === departmentFilter);
        const matchesRole = roleFilter === 'ALL' || row.member.user.role === roleFilter;
        const matchesStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'ACTIVE' ? effectiveActive : !effectiveActive);
        return matchesDepartment && matchesRole && matchesStatus;
      }),
    [departmentFilter, roleFilter, staffRows, statusFilter]
  );

  const assignmentCandidates = useMemo(
    () =>
      organizationMembers.filter((member) => {
        if (!member.isActive || !member.user.isActive) return false;
        if (member.user.role !== 'MANAGER' && member.user.role !== 'STAFF') return false;
        const membership = addMemberDepartment
          ? (membersByDepartment[addMemberDepartment.id] || []).find(
              (item) => item.userId === member.userId && item.isActive
            )
          : undefined;
        return !membership;
      }),
    [addMemberDepartment, membersByDepartment, organizationMembers]
  );

  const activeManagerCandidates = assignmentCandidates.filter((member) => member.user.role === 'MANAGER');

  const openCreateDepartment = () => {
    setDepartmentForm({ name: '', code: '', description: '' });
    setDepartmentFormError(null);
  };

  const openEditDepartment = (department: ManagedDepartment) => {
    setDepartmentForm({
      id: department.id,
      name: department.name,
      code: department.code || '',
      description: department.description || '',
    });
    setDepartmentFormError(null);
  };

  const submitDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!departmentForm || !organizationId) return;

    const name = departmentForm.name.trim();
    const description = departmentForm.description.trim();
    const code = departmentForm.code.trim();

    if (name.length < 2) {
      setDepartmentFormError('Department name must be at least 2 characters long.');
      return;
    }
    if (name.length > 255 || description.length > 1000 || code.length > 50) {
      setDepartmentFormError('One or more fields exceed the allowed length.');
      return;
    }

    setIsSavingDepartment(true);
    setDepartmentFormError(null);
    try {
      if (departmentForm.id) {
        await organizationsApi.updateDepartment(organizationId, departmentForm.id, {
          name,
          description: description || null,
          code: code || null,
        });
        setNotice('Department updated successfully.');
      } else {
        await organizationsApi.createDepartment(organizationId, {
          name,
          description: description || null,
          code: code || null,
        });
        setNotice('Department created successfully.');
      }
      setDepartmentForm(null);
      await loadManagementData(true);
    } catch (error) {
      setDepartmentFormError(messageFromError(error, 'Unable to save department.'));
    } finally {
      setIsSavingDepartment(false);
    }
  };

  const openDepartmentDetails = async (department: ManagedDepartment) => {
    if (!organizationId) return;
    setSelectedDepartment(department);
    setSelectedDepartmentMembers([]);
    setSelectedDepartmentMembersError(null);
    setIsLoadingDepartment(true);
    try {
      const [detailResult, rosterResult] = await Promise.allSettled([
        organizationsApi.getManagedDepartment(organizationId, department.id),
        organizationsApi.listManagedDepartmentMembers(organizationId, department.id),
      ]);

      if (detailResult.status === 'rejected') {
        throw detailResult.reason;
      }

      setSelectedDepartment(detailResult.value.department);
      if (rosterResult.status === 'fulfilled') {
        setSelectedDepartmentMembers(rosterResult.value.members || []);
      } else {
        setSelectedDepartmentMembersError(
          'Staff rosters are available only for departments you are authorized to manage.'
        );
      }
    } catch (error) {
      setPageError(messageFromError(error, 'Unable to load department details.'));
    } finally {
      setIsLoadingDepartment(false);
    }
  };

  const refreshSelectedDepartment = async (departmentId: string) => {
    if (!organizationId) return;
    const [detail, roster] = await Promise.all([
      organizationsApi.getManagedDepartment(organizationId, departmentId),
      organizationsApi.listManagedDepartmentMembers(organizationId, departmentId),
    ]);
    setSelectedDepartment(detail.department);
    setSelectedDepartmentMembers(roster.members || []);
    await loadManagementData(true);
  };

  const toggleDepartmentStatus = (department: ManagedDepartment) => {
    if (!organizationId) return;
    const nextActive = !department.isActive;
    setConfirmation({
      title: nextActive ? 'Activate department?' : 'Deactivate department?',
      description: nextActive
        ? `Activate ${department.name} for future staff assignments and issue routing.`
        : `Deactivate ${department.name}? Historical issues and staff records will be preserved. The server will reject the change if it is not safe.`,
      confirmLabel: nextActive ? 'Activate Department' : 'Deactivate Department',
      destructive: !nextActive,
      action: async () => {
        await organizationsApi.updateDepartmentStatus(organizationId, department.id, nextActive);
        setNotice(`${department.name} is now ${nextActive ? 'active' : 'inactive'}.`);
        await loadManagementData(true);
      },
    });
  };

  const submitAddDepartmentMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organizationId || !addMemberDepartment || !newDepartmentMemberId) {
      setAddMemberError('Select an active organization member first.');
      return;
    }

    const chosen = organizationMembers.find((member) => member.userId === newDepartmentMemberId);
    if (newDepartmentMemberRole === 'MANAGER' && chosen?.user.role !== 'MANAGER') {
      setAddMemberError('Only an active organization manager can be assigned as a department manager.');
      return;
    }

    setIsAddingMember(true);
    setAddMemberError(null);
    try {
      await organizationsApi.addDepartmentMember(organizationId, addMemberDepartment.id, {
        userId: newDepartmentMemberId,
        roleInDepartment: newDepartmentMemberRole,
      });
      setNotice(`${chosen?.user.name || 'Member'} was added to ${addMemberDepartment.name}.`);
      const departmentId = addMemberDepartment.id;
      setAddMemberDepartment(null);
      setNewDepartmentMemberId('');
      await refreshSelectedDepartment(departmentId);
    } catch (error) {
      setAddMemberError(messageFromError(error, 'Unable to add this member to the department.'));
    } finally {
      setIsAddingMember(false);
    }
  };

  const updateDepartmentMemberRole = async (
    department: ManagedDepartment,
    member: DepartmentMemberSummary,
    roleInDepartment: DepartmentMemberRole
  ) => {
    if (!organizationId) return;
    if (roleInDepartment === 'MANAGER' && member.user.role !== 'MANAGER') {
      setPageError('Only a user with the existing Manager role can be set as a department manager.');
      return;
    }
    try {
      await organizationsApi.updateDepartmentMember(organizationId, department.id, member.userId, {
        roleInDepartment,
      });
      setNotice(`${member.user.name}'s department responsibility was updated.`);
      await refreshSelectedDepartment(department.id);
    } catch (error) {
      setPageError(messageFromError(error, 'Unable to update department responsibility.'));
    }
  };

  const removeDepartmentMember = (department: ManagedDepartment, member: DepartmentMemberSummary) => {
    if (!organizationId) return;
    setConfirmation({
      title: 'Remove department member?',
      description: `Remove ${member.user.name} from ${department.name}? This only deactivates their department membership; it does not delete their user account or organization membership.`,
      confirmLabel: 'Remove Member',
      destructive: true,
      action: async () => {
        await organizationsApi.removeDepartmentMember(organizationId, department.id, member.userId);
        setNotice(`${member.user.name} was removed from ${department.name}.`);
        await refreshSelectedDepartment(department.id);
      },
    });
  };

  const organizationRoleOptions = (member: OrganizationMemberSummary): OrganizationMemberRole[] => {
    if (user?.role === 'ORG_ADMIN') return ['MANAGER', 'STAFF', 'MEMBER'];
    if (member.orgRole === 'OWNER') return ['OWNER'];
    return ['ADMIN', 'MANAGER', 'STAFF', 'MEMBER'];
  };

  const changeOrganizationRole = async (
    member: OrganizationMemberSummary,
    role: OrganizationMemberRole
  ) => {
    if (!organizationId || member.orgRole === role) return;
    try {
      await organizationsApi.updateOrganizationMember(organizationId, member.userId, { role });
      setNotice(`${member.user.name}'s organization role was updated.`);
      await loadManagementData(true);
    } catch (error) {
      setPageError(messageFromError(error, 'Unable to update organization role.'));
    }
  };

  const toggleOrganizationMember = (member: OrganizationMemberSummary) => {
    if (!organizationId) return;
    const nextActive = !member.isActive;
    setConfirmation({
      title: nextActive ? 'Reactivate organization member?' : 'Deactivate organization member?',
      description: nextActive
        ? `Restore ${member.user.name}'s membership in ${dashboard?.organization.name || 'this organization'}.`
        : `Deactivate ${member.user.name}'s organization membership? Their account and historical issue records will remain intact.`,
      confirmLabel: nextActive ? 'Reactivate Member' : 'Deactivate Member',
      destructive: !nextActive,
      action: async () => {
        await organizationsApi.updateOrganizationMember(organizationId, member.userId, {
          isActive: nextActive,
        });
        setNotice(`${member.user.name}'s organization membership is now ${nextActive ? 'active' : 'inactive'}.`);
        await loadManagementData(true);
      },
    });
  };

  const confirmAction = async () => {
    if (!confirmation) return;
    setIsConfirming(true);
    try {
      await confirmation.action();
      setConfirmation(null);
    } catch (error) {
      setPageError(messageFromError(error, 'The requested change could not be completed.'));
      setConfirmation(null);
    } finally {
      setIsConfirming(false);
    }
  };

  if (user?.role === 'USER' || user?.role === 'STAFF') {
    return (
      <AccessDenied
        title="Organization management is restricted"
        description="Your account does not have organization administration privileges."
        onLogout={logout}
      />
    );
  }

  if (isAuthLoading || !isAuthenticated || !hasManagementAccess) return null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8 lg:py-8">
      <main className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/20 sm:flex-row sm:items-start sm:p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <Link href="/org/dashboard" className="inline-flex items-center gap-1 font-medium text-indigo-300 hover:text-indigo-200">
                <IconBuilding size={14} />
                Organization Operations
              </Link>
              <IconChevronRight size={13} />
              <span>Departments &amp; Staff</span>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Organization Management</h1>
                <StatusPill active label={roleLabel(user?.role)} />
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
                Manage operational departments and the staff memberships used for issue assignment.
                {dashboard?.organization.name ? ` ${dashboard.organization.name} is loaded from your authorized organization context.` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadManagementData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconRefresh size={14} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <Link href="/org/issues" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white">
              Issue Management <IconArrowRight size={14} />
            </Link>
          </div>
        </header>

        {notice && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" role="status">
            <span className="flex items-center gap-2"><IconCheck size={16} />{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss success message" className="text-emerald-300 hover:text-white"><IconX size={16} /></button>
          </div>
        )}

        {pageError && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
            <span>{pageError}</span>
            <button onClick={() => setPageError(null)} aria-label="Dismiss error message" className="text-rose-300 hover:text-white"><IconX size={16} /></button>
          </div>
        )}

        <div className="flex w-full gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1 sm:w-fit" role="tablist" aria-label="Organization management sections">
          <button onClick={() => setActiveTab('departments')} role="tab" aria-selected={activeTab === 'departments'} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'departments' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
            <span className="inline-flex items-center gap-2"><IconBuilding size={16} />Departments</span>
          </button>
          <button onClick={() => setActiveTab('staff')} role="tab" aria-selected={activeTab === 'staff'} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'staff' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
            <span className="inline-flex items-center gap-2"><IconUsers size={16} />Staff / Members</span>
          </button>
        </div>

        {isLoading ? (
          <ManagementSkeleton />
        ) : activeTab === 'departments' ? (
          <section className="space-y-4" aria-label="Departments">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-lg font-bold text-white">Departments</h2>
                <p className="text-sm text-slate-400">Active and historical operational units for this organization.</p>
              </div>
              {isOrganizationAdministrator && (
                <button onClick={openCreateDepartment} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition-colors hover:bg-indigo-500">
                  <IconBuilding size={16} /> Create Department
                </button>
              )}
            </div>

            {departmentViews.length === 0 ? (
              <EmptyState title="No departments configured." description="Create the first operational department to begin assigning staff and issues." action={isOrganizationAdministrator ? openCreateDepartment : undefined} actionLabel="Create Department" />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {departmentViews.map((department) => (
                  <article key={department.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm transition-colors hover:border-slate-700">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-white">{department.name}</h3>
                        {department.code && <p className="mt-1 font-mono text-[11px] font-semibold tracking-wide text-indigo-300">{department.code}</p>}
                      </div>
                      <StatusPill active={department.isActive} />
                    </div>
                    <p className="min-h-10 text-sm leading-relaxed text-slate-400">{department.description || 'No description provided.'}</p>
                    <dl className="my-4 space-y-2 border-y border-slate-800 py-3 text-xs">
                      <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">Manager</dt><dd className="text-right font-medium text-slate-200">{department.managerNames.length ? department.managerNames.join(', ') : 'Not assigned'}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Staff</dt><dd className="font-semibold text-slate-200">{department.staffCount}</dd></div>
                      {department.activeIssueCount !== undefined && <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Active issues</dt><dd className="font-semibold text-slate-200">{department.activeIssueCount}</dd></div>}
                    </dl>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <button onClick={() => void openDepartmentDetails(department)} className="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white">View Details</button>
                      {isOrganizationAdministrator && <button onClick={() => openEditDepartment(department)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white">Edit</button>}
                      {isOrganizationAdministrator && <button onClick={() => toggleDepartmentStatus(department)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${department.isActive ? 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10' : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'}`}>{department.isActive ? 'Deactivate' : 'Activate'}</button>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-4" aria-label="Staff and organization members">
            <div>
              <h2 className="text-lg font-bold text-white">Staff / Members</h2>
              <p className="text-sm text-slate-400">Organization memberships and department assignments. Role changes affect organization access only; they never expose credentials.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-3">
              <label className="space-y-1.5 text-xs font-semibold text-slate-400">Department
                <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-200 outline-none focus:border-indigo-500">
                  <option value="ALL">All departments</option>
                  {departmentViews.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-400">Role
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'ALL' | UserRole)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-200 outline-none focus:border-indigo-500">
                  {ROLE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-400">Membership status
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-200 outline-none focus:border-indigo-500">
                  <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </div>

            {visibleStaff.length === 0 ? (
              <EmptyState title="No organization members found." description={isDepartmentManager ? 'No members are visible in your department-scoped roster.' : 'Adjust the filters or add active organization members to a department.'} />
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {visibleStaff.map((row) => <StaffTableRow key={row.member.userId} row={row} canManage={isOrganizationAdministrator} isCurrentUser={row.member.userId === user?.id} roleOptions={organizationRoleOptions(row.member)} onRoleChange={changeOrganizationRole} onToggle={toggleOrganizationMember} />)}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 md:hidden">
                  {visibleStaff.map((row) => <StaffMobileCard key={row.member.userId} row={row} canManage={isOrganizationAdministrator} isCurrentUser={row.member.userId === user?.id} roleOptions={organizationRoleOptions(row.member)} onRoleChange={changeOrganizationRole} onToggle={toggleOrganizationMember} />)}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {departmentForm && <Dialog title={departmentForm.id ? 'Edit Department' : 'Create Department'} onClose={() => !isSavingDepartment && setDepartmentForm(null)}><form onSubmit={submitDepartment} className="space-y-4 p-5"><FormField label="Department name" required><input autoFocus value={departmentForm.name} onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })} maxLength={255} className="input" placeholder="Electrical" /></FormField><FormField label="Department code"><input value={departmentForm.code} onChange={(event) => setDepartmentForm({ ...departmentForm, code: event.target.value })} maxLength={50} className="input" placeholder="ELECTRICAL" /></FormField><FormField label="Description"><textarea value={departmentForm.description} onChange={(event) => setDepartmentForm({ ...departmentForm, description: event.target.value })} maxLength={1000} rows={4} className="input resize-y" placeholder="What does this department manage?" /></FormField>{departmentFormError && <InlineError message={departmentFormError} />}<div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setDepartmentForm(null)} disabled={isSavingDepartment} className="button-secondary">Cancel</button><button type="submit" disabled={isSavingDepartment} className="button-primary">{isSavingDepartment ? 'Saving...' : departmentForm.id ? 'Save Changes' : 'Create Department'}</button></div></form></Dialog>}

      {selectedDepartment && <Dialog title="Department Details" width="max-w-3xl" onClose={() => setSelectedDepartment(null)}><div className="space-y-5 p-5">{isLoadingDepartment ? <ManagementSkeleton compact /> : <><div className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-4 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold text-white">{selectedDepartment.name}</h3><StatusPill active={selectedDepartment.isActive} /></div>{selectedDepartment.code && <p className="mt-1 font-mono text-xs text-indigo-300">{selectedDepartment.code}</p>}<p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">{selectedDepartment.description || 'No description provided.'}</p></div>{isOrganizationAdministrator && selectedDepartment.isActive && <button onClick={() => { setAddMemberDepartment(selectedDepartment); setNewDepartmentMemberId(''); setNewDepartmentMemberRole('STAFF'); setAddMemberError(null); }} className="button-primary h-fit">Add Member</button>}</div><div><div className="mb-3 flex items-center justify-between"><div><h4 className="font-bold text-white">Department Staff</h4><p className="text-xs text-slate-400">Manager and staff memberships used by the issue assignment workflow.</p></div><span className="text-xs font-semibold text-slate-400">{selectedDepartmentMembers.length} total</span></div>{selectedDepartmentMembersError ? <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-400">{selectedDepartmentMembersError}</div> : selectedDepartmentMembers.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">No members assigned to this department.</div> : <div className="space-y-2">{selectedDepartmentMembers.map((member) => { const canChange = (isOrganizationAdministrator || isDepartmentManager) && member.userId !== user?.id; const roles: DepartmentMemberRole[] = member.user.role === 'MANAGER' ? ['MANAGER', 'STAFF'] : ['STAFF']; return <div key={member.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{member.user.name}</p><p className="truncate text-xs text-slate-400">{member.user.email}</p></div><div className="flex flex-wrap items-center gap-2"><StatusPill active={member.isActive && member.user.isActive} /><select value={member.roleInDepartment.toUpperCase() === 'MANAGER' ? 'MANAGER' : 'STAFF'} disabled={!canChange} onChange={(event) => void updateDepartmentMemberRole(selectedDepartment, member, event.target.value as DepartmentMemberRole)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-60">{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select>{canChange && <button onClick={() => removeDepartmentMember(selectedDepartment, member)} className="rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/10">Remove</button>}</div></div>; })}</div>}</div></>}</div></Dialog>}

      {addMemberDepartment && <Dialog title={`Add Member to ${addMemberDepartment.name}`} onClose={() => !isAddingMember && setAddMemberDepartment(null)}><form onSubmit={submitAddDepartmentMember} className="space-y-4 p-5"><FormField label="Organization member" required><select autoFocus value={newDepartmentMemberId} onChange={(event) => setNewDepartmentMemberId(event.target.value)} className="input"><option value="">Select an active staff member</option>{(newDepartmentMemberRole === 'MANAGER' ? activeManagerCandidates : assignmentCandidates).map((member) => <option key={member.userId} value={member.userId}>{member.user.name} — {roleLabel(member.user.role)}</option>)}</select></FormField><FormField label="Department responsibility" required><select value={newDepartmentMemberRole} onChange={(event) => { const role = event.target.value as DepartmentMemberRole; setNewDepartmentMemberRole(role); if (role === 'MANAGER' && newDepartmentMemberId && !activeManagerCandidates.some((member) => member.userId === newDepartmentMemberId)) setNewDepartmentMemberId(''); }} className="input"><option value="STAFF">Staff</option><option value="MANAGER">Manager</option></select></FormField>{newDepartmentMemberRole === 'MANAGER' && <p className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs leading-relaxed text-indigo-200">Only active organization members whose existing CivicFix role is Manager are eligible for this department responsibility.</p>}{assignmentCandidates.length === 0 && <p className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-400">No eligible active organization staff are available for this department.</p>}{addMemberError && <InlineError message={addMemberError} />}<div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setAddMemberDepartment(null)} disabled={isAddingMember} className="button-secondary">Cancel</button><button type="submit" disabled={isAddingMember || !newDepartmentMemberId} className="button-primary">{isAddingMember ? 'Adding...' : 'Add Member'}</button></div></form></Dialog>}

      {confirmation && <Dialog title={confirmation.title} onClose={() => !isConfirming && setConfirmation(null)} width="max-w-md"><div className="space-y-5 p-5"><p className="text-sm leading-relaxed text-slate-300">{confirmation.description}</p><div className="flex justify-end gap-3"><button onClick={() => setConfirmation(null)} disabled={isConfirming} className="button-secondary">Cancel</button><button onClick={() => void confirmAction()} disabled={isConfirming} className={confirmation.destructive ? 'rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-60' : 'button-primary'}>{isConfirming ? 'Saving...' : confirmation.confirmLabel}</button></div></div></Dialog>}
    </div>
  );
}

function StaffTableRow({ row, canManage, isCurrentUser, roleOptions, onRoleChange, onToggle }: { row: StaffRow; canManage: boolean; isCurrentUser: boolean; roleOptions: OrganizationMemberRole[]; onRoleChange: (member: OrganizationMemberSummary, role: OrganizationMemberRole) => Promise<void>; onToggle: (member: OrganizationMemberSummary) => void }) {
  const active = row.member.isActive && row.member.user.isActive;
  return <tr className="align-top text-slate-300"><td className="px-5 py-4"><div className="font-semibold text-white">{row.member.user.name}</div><div className="mt-0.5 text-xs text-slate-400">{row.member.user.email}</div></td><td className="px-4 py-4"><div className="font-medium text-slate-200">{roleLabel(row.member.user.role)}</div><div className="mt-0.5 text-xs text-slate-500">Org: {roleLabel(row.member.orgRole)}</div></td><td className="px-4 py-4 text-xs leading-relaxed">{row.departments.length ? row.departments.map((department) => department.name).join(', ') : <span className="text-slate-500">Unassigned</span>}</td><td className="px-4 py-4"><StatusPill active={active} label={active ? 'Active' : 'Inactive'} /></td><td className="px-5 py-4"><div className="flex flex-wrap justify-end gap-2">{canManage && !isCurrentUser && <select aria-label={`Change role for ${row.member.user.name}`} value={row.member.orgRole} onChange={(event) => void onRoleChange(row.member, event.target.value as OrganizationMemberRole)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-semibold text-slate-200">{roleOptions.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select>}{canManage && !isCurrentUser && <button onClick={() => onToggle(row.member)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${active ? 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10' : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'}`}>{active ? 'Deactivate' : 'Activate'}</button>}</div></td></tr>;
}

function StaffMobileCard(props: React.ComponentProps<typeof StaffTableRow>) {
  const { row, canManage, isCurrentUser, roleOptions, onRoleChange, onToggle } = props;
  const active = row.member.isActive && row.member.user.isActive;
  return <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-bold text-white">{row.member.user.name}</h3><p className="truncate text-xs text-slate-400">{row.member.user.email}</p></div><StatusPill active={active} /></div><div className="grid grid-cols-2 gap-3 border-y border-slate-800 py-3 text-xs"><div><p className="text-slate-500">Role</p><p className="mt-1 font-semibold text-slate-200">{roleLabel(row.member.user.role)}</p></div><div><p className="text-slate-500">Department</p><p className="mt-1 font-semibold leading-relaxed text-slate-200">{row.departments.length ? row.departments.map((department) => department.name).join(', ') : 'Unassigned'}</p></div></div>{canManage && !isCurrentUser && <div className="flex flex-wrap gap-2"><select aria-label={`Change role for ${row.member.user.name}`} value={row.member.orgRole} onChange={(event) => void onRoleChange(row.member, event.target.value as OrganizationMemberRole)} className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs font-semibold text-slate-200">{roleOptions.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select><button onClick={() => onToggle(row.member)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${active ? 'border-amber-500/40 text-amber-300' : 'border-emerald-500/40 text-emerald-300'}`}>{active ? 'Deactivate' : 'Activate'}</button></div>}</article>;
}

function AccessDenied({ title, description, onLogout }: { title: string; description: string; onLogout: () => void }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100"><div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-300"><IconShield size={28} /></div><div><h1 className="text-xl font-bold text-white">{title}</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/dashboard" className="button-primary flex-1">Citizen Dashboard <IconArrowRight size={14} /></Link><button onClick={onLogout} className="button-secondary flex-1"><IconLogOut size={14} />Switch Account</button></div></div></div>;
}

function EmptyState({ title, description, action, actionLabel }: { title: string; description: string; action?: () => void; actionLabel?: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-14 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400"><IconUsers size={22} /></div><h3 className="font-bold text-white">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">{description}</p>{action && <button onClick={action} className="button-primary mt-5">{actionLabel}</button>}</div>;
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <label className="block space-y-1.5 text-sm font-semibold text-slate-300"><span>{label}{required && <span className="ml-1 text-rose-300">*</span>}</span>{children}</label>;
}

function InlineError({ message }: { message: string }) {
  return <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">{message}</p>;
}

function ManagementSkeleton({ compact = false }: { compact?: boolean }) {
  return <div className={`space-y-4 ${compact ? '' : 'pt-2'}`}><div className="grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: compact ? 2 : 6 }).map((_, index) => <div key={index} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3"><Skeleton className="h-5 w-3/5" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-8 w-full" /></div>)}</div></div>;
}
