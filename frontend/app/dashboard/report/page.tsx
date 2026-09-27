'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LocationPicker } from '@/components/map/LocationPicker';
import { Coordinates, DEFAULT_CAMPUS_LOCATION } from '@/lib/constants';
import {
  IconChevronLeft,
  IconPlusCircle,
  IconImage,
  IconMapPin,
  IconSparkles,
  IconCheckCircle,
} from '@/components/ui/Icons';

export default function ReportIssuePage() {
  const [selectedLocation, setSelectedLocation] = useState<Coordinates>(
    DEFAULT_CAMPUS_LOCATION
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/dashboard" className="hover:text-slate-200 transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium">Report an Issue</span>
      </nav>

      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 shadow-md space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          <span>Campus &amp; Community Intake</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Report a Civic Issue
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Submit photos, description, and location of issues on campus or in your neighborhood.
          Our automated routing engine assigns your report directly to the responsible facilities department.
        </p>
      </div>

      {/* Interactive Location Selection System */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <IconMapPin size={18} className="text-rose-400" />
            <span>Select Issue Location</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Pinpoint the exact location of the issue. Use browser GPS detection or drag the pin anywhere across the SRM Campus map.
          </p>
        </div>

        <LocationPicker
          value={selectedLocation}
          onChange={setSelectedLocation}
          height="h-[420px]"
        />
      </div>

      {/* Workflow Preview Card */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          How CivicFix Handles Your Report
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
              <IconImage size={18} />
            </div>
            <h4 className="text-sm font-semibold text-white">1. Photo &amp; Description</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload clear photos of the defect. AI analyzes severity, category, and duplicate detection.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <IconMapPin size={18} />
            </div>
            <h4 className="text-sm font-semibold text-white">2. Geolocation</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automatic GPS coordinates with manual map pin adjustment on OpenStreetMap.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <IconSparkles size={18} />
            </div>
            <h4 className="text-sm font-semibold text-white">3. Auto Routing</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Boundaries map reports automatically to <strong className="text-slate-300">SRM Campus Administration</strong>.
            </p>
          </div>
        </div>

        {/* Readiness Info Note */}
        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 text-indigo-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-indigo-300">
            <IconCheckCircle size={16} />
            <span>Interactive Map &amp; Location System Active</span>
          </div>
          <p className="leading-relaxed text-slate-300">
            Coordinates are stored in local client state (<code className="text-indigo-300 font-mono">{selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}</code>). Full report form submission and photographic evidence attachment will be integrated in upcoming prompts.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <IconChevronLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>

          <Link
            href="/dashboard/issues"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <IconPlusCircle size={16} />
            <span>View My Existing Issues</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
