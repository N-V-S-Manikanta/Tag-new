import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, CheckCircle2, Circle, Search } from 'lucide-react';
import { workAssignmentApi } from '../api/endpoints.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Card, EmptyState, Input, Select, Skeleton } from '../components/ui/primitives.jsx';
import { timeAgo } from '../lib/utils.js';

const STATUS_OPTIONS = ['All', 'OPEN', 'ACKNOWLEDGED', 'DONE'];

const STATUS_STYLE = {
  OPEN: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  ACKNOWLEDGED: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  DONE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
};

function platformPill(platform) {
  if (!platform) return 'General';
  return platform;
}

export default function MyAssignedWork() {
  const [filters, setFilters] = useState({ status: 'All', search: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['my-assigned-work', filters.status],
    queryFn: () => workAssignmentApi.list(filters.status === 'All' ? {} : { status: filters.status }),
  });

  const assignments = data?.assignments || [];

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const org = a.organization?.name || '';
      return [a.title, a.description, a.platform, org].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [assignments, filters.search]);

  const statusCounts = useMemo(() => {
    const counts = { OPEN: 0, ACKNOWLEDGED: 0, DONE: 0 };
    assignments.forEach((a) => {
      if (counts[a.status] !== undefined) counts[a.status] += 1;
    });
    return counts;
  }, [assignments]);

  return (
    <div>
      <PageHeader
        title="My Assigned Work"
        subtitle="All work assigned to you, with status and assignment details"
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Open</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-white">{statusCounts.OPEN}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Acknowledged</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-white">{statusCounts.ACKNOWLEDGED}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Done</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-white">{statusCounts.DONE}</p>
        </Card>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search title, organization, platform..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <Select
          className="sm:w-52"
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{status === 'All' ? 'All status' : status}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No assigned work"
          description="New tasks assigned by admin will appear here."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a._id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-800 dark:text-white">{a.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {a.organization?.name || 'Organization not set'}
                    {' · '}
                    Assigned {timeAgo(a.createdAt)}
                    {a.createdBy?.name ? ` by ${a.createdBy.name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {platformPill(a.platform)}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[a.status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {a.status === 'DONE' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {a.status}
                  </span>
                </div>
              </div>
              {a.description && (
                <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                  {a.description}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
