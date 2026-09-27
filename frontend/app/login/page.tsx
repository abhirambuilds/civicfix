'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { IconAlertCircle, IconArrowRight, IconSparkles } from '@/components/ui/Icons';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isExpired = searchParams.get('expired') === 'true';

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role && user.role !== 'USER') {
        router.replace('/org/dashboard');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please provide both email address and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const loggedInUser = await login(email.trim(), password);
      if (loggedInUser.role && loggedInUser.role !== 'USER') {
        router.push('/org/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Invalid login credentials. Please verify your email and password.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFillStudent = () => {
    setEmail('student@civicfix.demo');
    setPassword('Student@Demo2026!');
    setErrorMessage(null);
  };

  const handleQuickFillAdmin = () => {
    setEmail('srm.admin@civicfix.demo');
    setPassword('Password123!');
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-2xl space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20 text-base">
            CF
          </div>
          <span className="font-bold text-xl tracking-tight text-white">
            CivicFix
          </span>
        </Link>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Citizen &amp; Student Sign In
        </h2>
        <p className="text-xs text-slate-400">
          Enter your credentials to manage and track your reported issues.
        </p>
      </div>

      {/* Session Expired Notice */}
      {isExpired && (
        <div
          role="status"
          className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2"
        >
          <IconAlertCircle size={16} className="text-amber-400 shrink-0" />
          <span>Your session has expired. Please sign in again.</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-rose-900/60 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2.5"
        >
          <IconAlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-slate-300"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@civicfix.demo"
            className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-slate-300"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 rounded-lg font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <span>{isSubmitting ? 'Signing in...' : 'Sign In to Dashboard'}</span>
          {!isSubmitting && <IconArrowRight size={16} />}
        </button>
      </form>

      {/* Demo Credentials Quick-Fill */}
      <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/60 text-xs text-slate-400 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <IconSparkles size={14} className="text-indigo-400" />
            <span>Development Demo Accounts</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
          <span>Student: <code className="font-mono text-slate-300">student@civicfix.demo</code></span>
          <button
            type="button"
            onClick={handleQuickFillStudent}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline"
          >
            Fill Student
          </button>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
          <span>SRM Admin: <code className="font-mono text-slate-300">srm.admin@civicfix.demo</code></span>
          <button
            type="button"
            onClick={handleQuickFillAdmin}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 underline"
          >
            Fill Admin
          </button>
        </div>
      </div>

      <div className="text-center pt-2 border-t border-slate-800/80">
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
        >
          &larr; Return to CivicFix Homepage
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
