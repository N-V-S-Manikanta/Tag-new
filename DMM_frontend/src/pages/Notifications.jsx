import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, Check, XCircle, RefreshCw, Send, FileText, Trash2,
} from 'lucide-react';
import { notificationApi } from '../api/endpoints.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, EmptyState, Skeleton } from '../components/ui/primitives.jsx';
import { cn, timeAgo } from '../lib/utils.js';

const ICONS = {
  CONTENT_APPROVED: { icon: Check, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
  CONTENT_REJECTED: { icon: XCircle, color: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' },
  RESUBMISSION_REQUIRED: { icon: RefreshCw, color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
  CONTENT_POSTED: { icon: Send, color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
  NEW_REQUEST: { icon: FileText, color: 'text-brand-600 bg-brand-50 dark:bg-brand-500/10' },
  CONTENT_RESUBMITTED: { icon: RefreshCw, color: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10' },
};

export default function Notifications() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['notifications', 'all'], queryFn: () => notificationApi.list() });
  const notifications = data?.notifications || [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const readMut = useMutation({ mutationFn: (id) => notificationApi.markRead(id), onSuccess: invalidate });
  const readAllMut = useMutation({ mutationFn: () => notificationApi.markAllRead(), onSuccess: invalidate });
  const delMut = useMutation({ mutationFn: (id) => notificationApi.remove(id), onSuccess: invalidate });

  const open = (n) => {
    if (!n.isRead) readMut.mutate(n._id);
    if (n.link) navigate(n.link);
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={`${data?.unreadCount || 0} unread`}
        actions={notifications.some((n) => !n.isRead) && <Button variant="outline" onClick={() => readAllMut.mutate()}><CheckCheck className="h-4 w-4" /> Mark all read</Button>}
      />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const cfg = ICONS[n.type] || ICONS.NEW_REQUEST;
            const Icon = cfg.icon;
            return (
              <Card key={n._id} className={cn('flex items-center gap-4 p-4 transition', !n.isRead && 'border-l-4 border-l-brand-500')}>
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', cfg.color)}><Icon className="h-5 w-5" /></div>
                <button className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{n.title}</p>
                  <p className="truncate text-sm text-slate-400">{n.message}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                </button>
                {!n.isRead && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />}
                <button onClick={() => delMut.mutate(n._id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Trash2 className="h-4 w-4" /></button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
