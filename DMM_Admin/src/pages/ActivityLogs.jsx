import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Upload, FileImage, Send, CheckCircle2, XCircle, RefreshCw, UserPlus, UserCog, UserX, BarChart3, Activity,
} from 'lucide-react';
import { activityApi } from '../api/endpoints.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Card, Select, Avatar, Skeleton, EmptyState, Badge } from '../components/ui/primitives.jsx';
import { formatDateTime } from '../lib/utils.js';

const META = {
  TEMPLATE_UPLOAD: { icon: FileImage, label: 'Template Upload', cls: 'text-brand-600 bg-brand-50 dark:bg-brand-500/10' },
  ASSET_UPLOAD: { icon: Upload, label: 'Asset Upload', cls: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10' },
  APPROVAL_SUBMISSION: { icon: Send, label: 'Approval Submitted', cls: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
  APPROVAL_APPROVED: { icon: CheckCircle2, label: 'Approved', cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
  APPROVAL_REJECTED: { icon: XCircle, label: 'Rejected', cls: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' },
  APPROVAL_RESUBMITTED: { icon: RefreshCw, label: 'Resubmitted', cls: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
  POST_COMPLETION: { icon: CheckCircle2, label: 'Posted', cls: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
  USER_CREATED: { icon: UserPlus, label: 'User Created', cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
  USER_UPDATED: { icon: UserCog, label: 'User Updated', cls: 'text-brand-600 bg-brand-50 dark:bg-brand-500/10' },
  USER_DEACTIVATED: { icon: UserX, label: 'User Removed', cls: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' },
  ANALYTICS_UPDATED: { icon: BarChart3, label: 'Analytics Updated', cls: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10' },
};

export default function ActivityLogs() {
  const [action, setAction] = useState('All');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['activity', { action, page }], queryFn: () => activityApi.list({ action, page, limit: 25 }) });
  const logs = data?.logs || [];

  return (
    <div>
      <PageHeader title="Activity Logs" subtitle="System-wide audit trail of every key action." />

      <div className="mb-5 flex justify-end">
        <Select className="w-56" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="All">All actions</option>
          {Object.entries(META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : logs.length === 0 ? (
        <EmptyState icon={Activity} title="No activity found" description="Try a different filter." />
      ) : (
        <>
          <Card className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {logs.map((log) => {
              const m = META[log.action] || { icon: Activity, label: log.action, cls: 'text-slate-500 bg-slate-100 dark:bg-slate-800' };
              const Icon = m.icon;
              return (
                <div key={log._id} className="flex items-center gap-4 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.cls}`}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{log.description}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Avatar src={log.user?.avatar} name={log.user?.name} size="sm" className="!h-5 !w-5 !text-[9px]" />
                      <span className="text-xs text-slate-400">{log.user?.name} · {formatDateTime(log.createdAt)}</span>
                    </div>
                  </div>
                  <Badge className="hidden sm:inline-flex">{m.label}</Badge>
                </div>
              );
            })}
          </Card>

          {data?.pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm disabled:opacity-40">Prev</button>
              <span className="text-sm text-slate-400">Page {data.page} of {data.pages}</span>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
