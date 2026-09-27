import { Header } from '@/components/Header';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-6">
          <span>AI-Assisted Issue Reporting &amp; Resolution Platform</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-3xl">
          Report. Track. Resolve.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400">
            Civic issues made effortless.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed">
          CivicFix bridges citizens and administrations with automated routing,
          multi-organization support, and intelligent resolution workflows.
        </p>

        {/* Status / Architecture Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <div className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-2">
              Citizen / Student
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Issue Reporting</h2>
            <p className="text-sm text-slate-400 leading-normal">
              Submit issues with descriptions, categories, GPS location, and photos with real-time tracking.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <div className="text-sm font-semibold text-sky-400 uppercase tracking-wider mb-2">
              Organization Admin
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Triage &amp; Resolve</h2>
            <p className="text-sm text-slate-400 leading-normal">
              Manage departments, staff assignments, status transitions, priority levels, and resolution remarks.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <div className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              Platform Admin
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Multi-Organization</h2>
            <p className="text-sm text-slate-400 leading-normal">
              Oversee organizations, service areas, and routing rules across multiple institutions.
            </p>
          </div>
        </div>

        {/* System Architecture Note */}
        <div className="mt-12 p-4 rounded-lg border border-slate-800 bg-slate-900/30 text-xs text-slate-400 max-w-xl">
          <p className="font-semibold text-slate-300 mb-1">Architecture Foundation (Round 1)</p>
          <p>
            Backend API service running with Express + TypeScript. Seeded organization: SRM Campus Administration.
          </p>
        </div>
      </main>

      <footer className="w-full border-t border-slate-800/60 py-6 text-center text-xs text-slate-400">
        <p>CivicFix &bull; Hackathon Round 1 Foundation</p>
      </footer>
    </div>
  );
}
