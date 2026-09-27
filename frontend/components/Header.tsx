import Link from 'next/link';

export function Header() {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
            CF
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-white">CivicFix</span>
            <span className="text-[10px] text-slate-400 -mt-1 tracking-wider uppercase">
              Report &bull; Track &bull; Resolve
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Foundation Phase
          </span>
        </div>
      </div>
    </header>
  );
}
