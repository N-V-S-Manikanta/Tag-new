import { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { ArrowUp, ArrowDown, Minus, TrendingUp } from 'lucide-react';
import { Card, Skeleton, EmptyState } from './ui/primitives.jsx';
import { cn, formatNumber } from '../lib/utils.js';

const HIGHLIGHT_PRIORITY = ['followers', 'subscribers', 'impressions', 'engagementRate', 'newFollowers', 'reach', 'views', 'pageViews'];
const fmt = (v, isPct) => (isPct ? `${Number(v || 0).toFixed(1)}%` : formatNumber(v || 0));
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function DeltaBadge({ delta, isPct, size = 'sm' }) {
  if (!delta) return null;
  const { change, changePct, previous } = delta;
  const isNew = (!previous || previous === 0) && delta.current > 0;
  const up = change > 0, down = change < 0;
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
  const cls = up ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10'
    : down ? 'text-rose-600 bg-rose-50 dark:bg-rose-500/10'
    : 'text-slate-400 bg-slate-100 dark:bg-slate-800';
  const changeText = isPct ? `${change > 0 ? '+' : ''}${change.toFixed(1)} pts` : `${change > 0 ? '+' : ''}${formatNumber(change)}`;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full font-semibold', cls, size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs')}>
      <Icon className="h-3 w-3" />
      {isNew ? 'New' : changeText}
      {!isNew && changePct != null && <span className="opacity-70">({changePct > 0 ? '+' : ''}{changePct}%)</span>}
    </span>
  );
}

// `report` is the payload from /api/analytics/:platform/report
export default function AnalyticsReport({ report, isLoading }) {
  const [barMetric, setBarMetric] = useState(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (!report?.hasData) {
    return <EmptyState icon={TrendingUp} title="No data yet" description="Enter this platform's metrics to see the analytics report and week-over-week changes." />;
  }

  const { latest, previous, deltas, groups, labels, percentFields, series } = report;
  const pct = new Set(percentFields || []);
  const fields = Object.values(groups).flat();
  const highlights = HIGHLIGHT_PRIORITY.filter((f) => fields.includes(f)).slice(0, 4);
  const audienceField = fields.includes('followers') ? 'followers' : fields.includes('subscribers') ? 'subscribers' : highlights[0];
  const activeBar = barMetric || (fields.includes('impressions') ? 'impressions' : highlights[0]);

  return (
    <div className="space-y-5">
      {previous && (
        <p className="text-xs text-slate-400">
          Comparing latest entry ({fmtDate(latest.date)}) with previous ({fmtDate(previous.date)})
        </p>
      )}

      {/* Highlight cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {highlights.map((f) => (
          <Card key={f} className="p-5">
            <p className="text-sm font-medium text-slate-400">{labels[f]}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">{fmt(latest[f], pct.has(f))}</p>
            <div className="mt-2"><DeltaBadge delta={deltas[f]} isPct={pct.has(f)} /></div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-1 font-bold text-slate-800 dark:text-white">{labels[audienceField]} growth</h3>
          <p className="mb-4 text-xs text-slate-400">Across recent entries</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={series} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="aud" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} labelFormatter={fmtDate} formatter={(v) => formatNumber(v)} />
              <Area type="monotone" dataKey={audienceField} stroke="#7c3aed" strokeWidth={2.5} fill="url(#aud)" name={labels[audienceField]} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white">Weekly {labels[activeBar]}</h3>
            <select className="input-base h-9 w-auto py-1 text-xs" value={activeBar} onChange={(e) => setBarMetric(e.target.value)}>
              {fields.filter((f) => !pct.has(f)).map((f) => <option key={f} value={f}>{labels[f]}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} labelFormatter={fmtDate} formatter={(v) => formatNumber(v)} cursor={{ fill: 'rgba(124,58,237,0.06)' }} />
              <Bar dataKey={activeBar} radius={[6, 6, 0, 0]} fill="#7c3aed" name={labels[activeBar]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Sectioned metrics with deltas */}
      <div className="space-y-4">
        {Object.entries(groups).map(([group, groupFields]) => (
          <Card key={group} className="p-5">
            <h3 className="mb-4 font-bold text-slate-800 dark:text-white">{group}</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {groupFields.map((f) => (
                <div key={f} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                  <p className="text-xs text-slate-400">{labels[f]}</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-800 dark:text-white">{fmt(latest[f], pct.has(f))}</p>
                  <div className="mt-1.5"><DeltaBadge delta={deltas[f]} isPct={pct.has(f)} /></div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
