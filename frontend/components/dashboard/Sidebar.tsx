'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  IconDashboard,
  IconFileText,
  IconPlusCircle,
  IconLogOut,
  IconSparkles,
  IconX,
  IconBuilding,
  IconLayers,
} from '@/components/ui/Icons';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isStaffRole = user?.role && user.role !== 'USER';

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: IconDashboard,
      active: pathname === '/dashboard',
    },
    {
      label: 'My Issues',
      href: '/dashboard/issues',
      icon: IconFileText,
      active: pathname.startsWith('/dashboard/issues'),
    },
    {
      label: 'Report Issue',
      href: '/dashboard/report',
      icon: IconPlusCircle,
      active: pathname === '/dashboard/report',
      highlight: true,
    },
    ...(isStaffRole
      ? [
          {
            label: 'Org Dashboard',
            href: '/org/dashboard',
            icon: IconBuilding,
            active: pathname === '/org/dashboard',
          },
          {
            label: 'Issue Management',
            href: '/org/issues',
            icon: IconLayers,
            active: pathname.startsWith('/org/issues'),
          },
        ]
      : []),
  ];

  return (
    <aside className="w-64 h-full flex flex-col bg-slate-950 border-r border-slate-800/80 text-slate-200">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1"
          onClick={onCloseMobile}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 via-indigo-600 to-sky-400 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20 text-sm">
            CF
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-white leading-tight">
              CivicFix
            </span>
            <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">
              Student / Citizen
            </span>
          </div>
        </Link>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close navigation menu"
          >
            <IconX size={20} />
          </button>
        )}
      </div>

      {/* Primary Action Button */}
      <div className="p-4">
        <Link
          href="/dashboard/report"
          onClick={onCloseMobile}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          <IconPlusCircle size={18} />
          <span>Report an Issue</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1" aria-label="Sidebar Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                item.active
                  ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Icon
                size={18}
                className={item.active ? 'text-indigo-400' : 'text-slate-400'}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Campus Context Banner */}
      <div className="px-4 py-3 mx-3 mb-3 rounded-lg border border-slate-800/80 bg-slate-900/40 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 text-indigo-300 font-medium mb-1">
          <IconSparkles size={14} />
          <span>Campus Auto-Route</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-normal">
          Reports within campus boundaries resolve automatically to <strong className="text-slate-300 font-semibold">SRM Campus Administration</strong>.
        </p>
      </div>

      {/* User Identity / Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-300 shrink-0">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="text-xs font-semibold text-white truncate">
              {user?.name || 'Citizen User'}
            </span>
            <span className="text-[10px] text-slate-400 truncate">
              {user?.email || 'Authenticated'}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          title="Sign Out"
          aria-label="Sign Out"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <IconLogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
