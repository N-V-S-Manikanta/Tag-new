import { useQuery } from '@tanstack/react-query';
import { Linkedin, Instagram, Youtube, Facebook, Target, Users, Send } from 'lucide-react';
import { goalApi } from '../../api/endpoints.js';
import { Card } from '../ui/primitives.jsx';
import { formatNumber, cn } from '../../lib/utils.js';

const PLATFORM_META = {
  LinkedIn: { icon: Linkedin, color: '#0A66C2' },
  Instagram: { icon: Instagram, color: '#E1306C' },
  YouTube: { icon: Youtube, color: '#FF0000' },
  Facebook: { icon: Facebook, color: '#1877F2' },
};
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Shows the org's growth goals — one block per platform that has a goal set.
// Renders nothing until the admin sets at least one goal.
export default function GoalCard({ orgId }) {
  const { data } = useQuery({ queryKey: ['org-goals', orgId], queryFn: () => goalApi.list(orgId), enabled: !!orgId });
  const goals = (data?.goals || []).filter((g) => g.targetFollowers > 0 || g.targetPosts > 0);
  if (!goals.length) return null;

  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800 dark:text-white">
        <Target className="h-5 w-5 text-brand-600" /> Growth goals
      </h3>
      <div className={cn('grid gap-5', goals.length > 1 && 'sm:grid-cols-2')}>
        {goals.map((g) => <PlatformGoal key={g._id} goal={g} />)}
      </div>
    </Card>
  );
}

function PlatformGoal({ goal }) {
  const meta = PLATFORM_META[goal.platform] || {};
  const Icon = meta.icon || Target;
  const p = goal.progress || {};
  const daysLeft = Math.max(0, Math.ceil((new Date(goal.endDate) - Date.now()) / 86400000));
  const audience = goal.platform === 'YouTube' ? 'subscribers' : 'followers';

  return (
    <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <span className="flex h-6 w-6 items-center justify-center rounded-md text-white" style={{ background: meta.color || '#64748b' }}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          {goal.platform}
        </span>
        <span className="text-[11px] font-semibold text-slate-400">
          {fmtDate(goal.startDate)} → {fmtDate(goal.endDate)} · {daysLeft ? `${daysLeft}d left` : 'ended'}
        </span>
      </div>
      <div className="space-y-3">
        {goal.targetFollowers > 0 && (
          <Bar icon={Users} label={audience} current={p.currentFollowers || 0} target={goal.targetFollowers} color={meta.color || '#7c3aed'} />
        )}
        {goal.targetPosts > 0 && (
          <Bar icon={Send} label="posts" current={p.postsPublished || 0} target={goal.targetPosts} color="#0ea5e9" />
        )}
      </div>
    </div>
  );
}

function Bar({ icon: Icon, label, current, target, color }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 font-medium capitalize text-slate-500 dark:text-slate-400"><Icon className="h-3.5 w-3.5" /> {label}</span>
        <span className="font-semibold text-slate-600 dark:text-slate-300">{formatNumber(current)} / {formatNumber(target)} <span className="text-slate-400">({pct}%)</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
