import { useQuery } from '@tanstack/react-query';
import { Target, Users, Send } from 'lucide-react';
import { libraryApi } from '../../api/endpoints.js';
import { Card } from '../ui/primitives.jsx';
import { formatNumber } from '../../lib/utils.js';

// Shows the org's yearly goal progress. Renders nothing until a target is set.
export default function GoalCard({ orgId }) {
  const { data } = useQuery({ queryKey: ['org-goal', orgId], queryFn: () => libraryApi.goal(orgId), enabled: !!orgId });
  const goal = data?.goal;
  const progress = data?.progress || { currentFollowers: 0, currentPosts: 0 };
  if (!goal || (!goal.targetFollowers && !goal.targetPosts)) return null;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white"><Target className="h-5 w-5 text-brand-600" /> Goal for {data.year}</h3>
        {goal.note && <span className="text-xs text-slate-400">{goal.note}</span>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Bar icon={Users} label="Followers" current={progress.currentFollowers} target={goal.targetFollowers} color="#7c3aed" />
        <Bar icon={Send} label="Posts published" current={progress.currentPosts} target={goal.targetPosts} color="#0ea5e9" />
      </div>
    </Card>
  );
}

function Bar({ icon: Icon, label, current, target, color }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300"><Icon className="h-4 w-4" /> {label}</span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">{formatNumber(current)} / {target ? formatNumber(target) : '—'}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="mt-1 text-right text-xs text-slate-400">{target ? `${pct}%` : 'no target'}</p>
    </div>
  );
}
