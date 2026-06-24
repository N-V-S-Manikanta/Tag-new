import {
  Upload, CheckCircle2, XCircle, Send, RefreshCw, FileImage, Activity,
} from 'lucide-react';
import { Card, Avatar, EmptyState } from '../ui/primitives.jsx';
import { timeAgo } from '../../lib/utils.js';

const ICONS = {
  TEMPLATE_UPLOAD: { icon: FileImage, color: 'text-brand-600 bg-brand-50 dark:bg-brand-500/10' },
  ASSET_UPLOAD: { icon: Upload, color: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10' },
  APPROVAL_SUBMISSION: { icon: Send, color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
  APPROVAL_APPROVED: { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
  APPROVAL_REJECTED: { icon: XCircle, color: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' },
  APPROVAL_RESUBMITTED: { icon: RefreshCw, color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
  POST_COMPLETION: { icon: CheckCircle2, color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
};

export default function ActivityTimeline({ activity }) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold text-slate-800 dark:text-white">Recent Activity</h3>
      {!activity?.length ? (
        <EmptyState icon={Activity} title="No activity yet" description="Actions across the platform will appear here." />
      ) : (
        <div className="space-y-1">
          {activity.map((log) => {
            const cfg = ICONS[log.action] || ICONS.APPROVAL_SUBMISSION;
            const Icon = cfg.icon;
            return (
              <div key={log._id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700 dark:text-slate-200">{log.description}</p>
                  <p className="text-[11px] text-slate-400">{timeAgo(log.createdAt)}</p>
                </div>
                {log.user && <Avatar src={log.user.avatar} name={log.user.name} size="sm" />}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
