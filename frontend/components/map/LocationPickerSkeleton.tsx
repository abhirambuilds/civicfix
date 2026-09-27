import React from 'react';
import { IconMapPin } from '@/components/ui/Icons';

interface LocationPickerSkeletonProps {
  height?: string;
}

export function LocationPickerSkeleton({
  height = 'h-96',
}: LocationPickerSkeletonProps) {
  return (
    <div
      className={`relative w-full ${height} rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col items-center justify-center space-y-3`}
      aria-label="Map loading placeholder"
    >
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />

      {/* Pulsing Pin Icon */}
      <div className="relative z-10 w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center animate-bounce shadow-md">
        <IconMapPin size={24} />
      </div>

      <div className="relative z-10 text-center space-y-1">
        <p className="text-xs font-semibold text-slate-300">
          Loading OpenStreetMap tiles...
        </p>
        <p className="text-[11px] text-slate-500">
          Preparing interactive campus location picker
        </p>
      </div>

      {/* Shimmer line */}
      <div className="relative z-10 w-40 h-1 rounded-full bg-slate-800 overflow-hidden">
        <div className="w-1/2 h-full bg-indigo-500/60 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
