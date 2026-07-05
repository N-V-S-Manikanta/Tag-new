import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts';
import { competitorApi } from '../api/endpoints.js';
import { Card, Skeleton } from './ui/primitives.jsx';
import { formatNumber } from '../lib/utils.js';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316'];

// Read-only competitor benchmark for the product app. Renders nothing unless an
// admin has added at least one competitor for this platform.
export default function CompetitorBenchmark({ platform }) {
  const { data, isLoading } = useQuery({ queryKey: ['competitors', platform], queryFn: () => competitorApi.list(platform) });

  if (isLoading) return <Skeleton className="h-72" />;

  const labels = data?.labels || {};
  const fields = data?.fields || [];
  const pct = new Set(data?.percentFields || []);
  const competitors = data?.competitors || [];
  if (competitors.length === 0) return null; // nothing to show until admin adds competitors

  const rows = [data.own, ...competitors].filter(Boolean).sort((a, b) => (b.followers || 0) - (a.followers || 0));
  const chartData = rows.map((r, i) => ({ name: r.isSelf ? `${r.name} (You)` : r.name, value: r.followers || 0, self: !!r.isSelf, color: r.color || COLORS[i % COLORS.length] }));
  const fmt = (v, key) => (pct.has(key) ? `${Number(v || 0).toFixed(1)}%` : formatNumber(v || 0));

  return (
    <div className="mt-5 space-y-5">
      <h2 className="text-lg font-bold text-slate-800 dark:text-white">Competitors — {platform}</h2>

      <Card className="p-5">
        <h3 className="mb-4 font-bold text-slate-800 dark:text-white">Followers — you vs. competitors</h3>
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 46)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 72 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} formatter={(v) => formatNumber(v)} cursor={{ fill: 'rgba(124,58,237,0.06)' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Followers">
              {chartData.map((d, i) => <Cell key={i} fill={d.self ? '#7c3aed' : d.color} />)}
              <LabelList dataKey="value" position="right" formatter={(v) => formatNumber(v)}
                style={{ fontSize: 12, fontWeight: 700, fill: '#475569' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
              <th className="px-5 py-3 font-semibold">#</th>
              <th className="px-5 py-3 font-semibold">Company</th>
              {fields.map((f) => <th key={f} className="px-5 py-3 font-semibold">{labels[f]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {rows.map((r, i) => (
              <tr key={r._id || 'self'} className={r.isSelf ? 'bg-brand-50/50 dark:bg-brand-500/5' : ''}>
                <td className="px-5 py-3 font-bold text-slate-400">{i + 1}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.isSelf ? '#7c3aed' : (r.color || COLORS[i % COLORS.length]) }} />
                    {r.name}
                    {r.isSelf && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700 dark:bg-brand-900 dark:text-brand-200">You</span>}
                  </span>
                </td>
                {fields.map((f) => (
                  <td key={f} className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-200">{fmt(r[f], f)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
