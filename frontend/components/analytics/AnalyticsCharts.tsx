'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsPoint } from '@/types';

const COLORS = ['#818cf8', '#38bdf8', '#a78bfa', '#f59e0b', '#34d399', '#fb7185', '#94a3b8'];

function hasValues(data: AnalyticsPoint[]): boolean {
  return data.some((item) => item.value > 0);
}

function EmptyChart({ message = 'No issue data available for this period.' }: { message?: string }) {
  return <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-5 text-center text-sm text-slate-500">{message}</div>;
}

function ChartLegendList({ data }: { data: AnalyticsPoint[] }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
      {data.map((item, index) => (
        <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/50 px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-slate-300">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            <span className="truncate">{item.label}</span>
          </span>
          <span className="font-bold text-white">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function chartTooltipStyle() {
  return {
    contentStyle: {
      backgroundColor: '#0f172a',
      border: '1px solid #334155',
      borderRadius: 10,
      color: '#e2e8f0',
      fontSize: 12,
    },
    itemStyle: { color: '#e2e8f0' },
    labelStyle: { color: '#94a3b8' },
  };
}

export function AnalyticsCharts({
  byStatus,
  byPriority,
  byCategory,
  byDepartment,
  trend,
}: {
  byStatus: AnalyticsPoint[];
  byPriority: AnalyticsPoint[];
  byCategory: AnalyticsPoint[];
  byDepartment: AnalyticsPoint[];
  trend: AnalyticsPoint[];
}) {
  const tooltipStyle = chartTooltipStyle();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title="Issues by status" description="Every issue in the selected organization scope.">
          {!hasValues(byStatus) ? <><EmptyChart /><ChartLegendList data={byStatus} /></> : <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2}>
                    {byStatus.map((item, index) => <Cell key={item.label} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(value) => [value, 'Issues']} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ChartLegendList data={byStatus} />
          </>}
        </ChartCard>

        <ChartCard title="Issues by priority" description="Operational priority mix based on the issue priority enum.">
          {!hasValues(byPriority) ? <><EmptyChart /><ChartLegendList data={byPriority} /></> : <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byPriority} dataKey="value" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2}>
                    {byPriority.map((item, index) => <Cell key={item.label} fill={COLORS[(index + 2) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(value) => [value, 'Issues']} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ChartLegendList data={byPriority} />
          </>}
        </ChartCard>
      </div>

      <ChartCard title="Issues by category" description="Categories are loaded from the organization's issue data; no categories are hardcoded.">
        {!hasValues(byCategory) ? <EmptyChart /> : <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} layout="vertical" margin={{ left: 8, right: 12, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={112} stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(value) => [value, 'Issues']} />
                <Bar dataKey="value" name="Issues" radius={[0, 5, 5, 0]} fill="#818cf8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartLegendList data={byCategory} />
        </>}
      </ChartCard>

      <ChartCard title="Issues by department" description="Unassigned issues remain visible instead of being dropped from the distribution.">
        {!hasValues(byDepartment) ? <EmptyChart message="No department issue data available for this period." /> : <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDepartment} layout="vertical" margin={{ left: 8, right: 12, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={128} stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(value) => [value, 'Issues']} />
                <Bar dataKey="value" name="Issues" radius={[0, 5, 5, 0]} fill="#38bdf8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartLegendList data={byDepartment} />
        </>}
      </ChartCard>

      <ChartCard title="Issue volume over time" description="Created issue count by UTC calendar day.">
        {!hasValues(trend) ? <EmptyChart message="No issue data available for this period." /> : <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: 0, right: 12, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={22} />
                <YAxis allowDecimals={false} stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(value) => [value, 'Created issues']} />
                <Line type="monotone" dataKey="value" name="Created issues" stroke="#34d399" strokeWidth={3} dot={{ r: 3, fill: '#34d399' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ChartLegendList data={trend} />
        </>}
      </ChartCard>
    </div>
  );
}
