import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Linkedin, Instagram, Youtube, Facebook, Twitter, Globe, Check, X as XIcon, ExternalLink, Search, ArrowUpDown, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { analyticsApi } from '../api/endpoints.js';
import { Card, Skeleton, EmptyState } from './ui/primitives.jsx';
import { formatNumber, formatDate, cn } from '../lib/utils.js';

const ICON = { LinkedIn: Linkedin, Instagram: Instagram, YouTube: Youtube, Facebook: Facebook, 'X (Twitter)': Twitter, Website: Globe };
const COLOR = { LinkedIn: '#0A66C2', Instagram: '#E1306C', YouTube: '#FF0000', Facebook: '#1877F2', 'X (Twitter)': '#0f172a', Website: '#0ea5e9' };
const PAGE = 12;

// Cross-organization grid: one row per org, one column per platform. Each cell
// shows the follower/subscriber count (clickable → that org+platform analytics)
// or "No account". Data is fetched dynamically from /api/analytics/overview.
export default function AnalyticsOverview({ onOpen }) {
  const { data, isLoading } = useQuery({ queryKey: ['analytics-overview'], queryFn: analyticsApi.overview });
  const platforms = data?.platforms || [];
  const orgs = data?.organizations || [];
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'desc' });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));
    if (sort.key) {
      list = [...list].sort((a, b) => {
        const av = a.cells[sort.key]?.metric ?? -1;
        const bv = b.cells[sort.key]?.metric ?? -1;
        return sort.dir === 'desc' ? bv - av : av - bv;
      });
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [orgs, search, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE, current * PAGE);

  const toggleSort = (key, sortable) => {
    if (!sortable) return;
    setPage(1);
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
  };

  if (isLoading) {
    return <Card className="p-4"><div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div></Card>;
  }
  if (!orgs.length) {
    return <EmptyState icon={Building2} title="No organizations yet" description="Create organizations and add their social accounts to see the overview grid." />;
  }

  const headBg = 'bg-white dark:bg-slate-900';

  return (
    <Card className="overflow-hidden p-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search organizations…" className="input-base h-10 pl-9" />
        </div>
        <p className="text-xs text-slate-400">{filtered.length} organization{filtered.length === 1 ? '' : 's'} · click a count to open its analytics</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className={cn('border-b border-slate-100 dark:border-slate-800', headBg)}>
              <th className={cn('sticky left-0 z-30 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500', headBg)}>Organization</th>
              {platforms.map((p) => {
                const Icon = ICON[p.key] || Globe;
                const sortable = p.kind === 'analytics';
                const activeSort = sort.key === p.key;
                return (
                  <th key={p.key} onClick={() => toggleSort(p.key, sortable)}
                    className={cn('px-3 py-3 text-center', sortable && 'cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800')}>
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: COLOR[p.key] || '#64748b' }}><Icon className="h-4 w-4" /></span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {p.key}
                        {sortable && <ArrowUpDown className={cn('h-3 w-3', activeSort ? 'text-brand-600' : 'text-slate-300')} />}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((o, i) => (
              <tr key={o._id} className={cn('border-b border-slate-50 transition-colors last:border-0 dark:border-slate-800/60', i % 2 ? 'bg-slate-50/40 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900', 'hover:bg-brand-50/50 dark:hover:bg-brand-500/5')}>
                <td className={cn('sticky left-0 z-10 px-4 py-2.5 font-semibold text-slate-800 dark:text-white', i % 2 ? 'bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-900')}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color || '#94a3b8' }} />
                    <span className="truncate">{o.name}</span>
                  </span>
                </td>
                {platforms.map((p) => <OverviewCell key={p.key} org={o} platform={p} onOpen={onOpen} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 p-3 dark:border-slate-800">
          <button disabled={current === 1} onClick={() => setPage(current - 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /> Prev</button>
          <span className="text-xs text-slate-400">Page {current} of {pages}</span>
          <button disabled={current === pages} onClick={() => setPage(current + 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800">Next <ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </Card>
  );
}

function OverviewCell({ org, platform, onOpen }) {
  const c = org.cells[platform.key] || { exists: false };
  if (!c.exists) {
    return (
      <td className="px-3 py-2.5 text-center">
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-500 dark:bg-rose-500/10 dark:text-rose-400"><XIcon className="h-3 w-3" /> No account</span>
      </td>
    );
  }
  const tip = [
    c.username && (platform.key === 'Website' ? c.username : `@${c.username}`),
    c.metric != null && `${formatNumber(c.metric)} ${c.label}`,
    c.lastUpdated && `Updated ${formatDate(c.lastUpdated)}`,
  ].filter(Boolean).join(' · ');
  const big = c.metric != null ? formatNumber(c.metric) : 'Yes';
  const sub = c.metric != null ? c.label : (c.username || (platform.kind === 'website' ? 'Live site' : 'Linked'));

  const inner = (
    <span className="inline-flex flex-col items-center leading-tight">
      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400"><Check className="h-3.5 w-3.5" />{big}</span>
      <span className="max-w-[120px] truncate text-[11px] text-slate-400">{sub}</span>
    </span>
  );

  if (platform.kind === 'analytics') {
    return (
      <td className="px-3 py-2.5 text-center">
        <button title={tip} onClick={() => onOpen(org._id, platform.key)} className="rounded-lg px-2 py-1 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10">{inner}</button>
      </td>
    );
  }
  if (c.url) {
    const href = /^https?:\/\//i.test(c.url) ? c.url : `https://${c.url}`;
    return (
      <td className="px-3 py-2.5 text-center">
        <a href={href} target="_blank" rel="noreferrer" title={tip} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-500/10">{inner}<ExternalLink className="h-3 w-3 text-slate-400" /></a>
      </td>
    );
  }
  return <td className="px-3 py-2.5 text-center" title={tip}>{inner}</td>;
}
