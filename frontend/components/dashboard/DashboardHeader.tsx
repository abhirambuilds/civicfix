'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { IconMenu, IconLogOut, IconPlusCircle } from '@/components/ui/Icons';

interface DashboardHeaderProps {
  title?: string;
  onOpenMobileMenu?: () => void;
}

export function DashboardHeader({
  title = 'Dashboard',
  onOpenMobileMenu,
}: DashboardHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 px-4 sm:px-6 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Open navigation menu"
          >
            <IconMenu size={20} />
          </button>
        )}

        <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Quick Report CTA (Desktop/Tablet) */}
        <Link
          href="/dashboard/report"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <IconPlusCircle size={15} />
          <span>New Report</span>
        </Link>

        {/* User Identity Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800/80">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center font-bold text-xs text-white shadow-sm">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'CF'}
          </div>

          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-semibold text-white leading-tight">
              {user?.name || 'Citizen'}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">
              Verified Student
            </span>
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            title="Log Out"
            aria-label="Log Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <IconLogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
