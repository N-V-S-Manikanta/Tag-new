import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Linkedin, Instagram, Youtube, Facebook, Target, Save, Users, Send, Trash2, PenLine, CalendarRange, X } from 'lucide-react';
import { goalApi } from '../api/endpoints.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import OrgPicker from '../components/OrgPicker.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, Input, Skeleton } from '../components/ui/primitives.jsx';
import { cn, formatNumber, formatDate } from '../lib/utils.js';

const PLATFORMS = [
  { key: 'LinkedIn', icon: Linkedin, color: '#0A66C2', audience: 'followers' },
  { key: 'Instagram', icon: Instagram, color: '#E1306C', audience: 'followers' },
  { key: 'YouTube', icon: Youtube, color: '#FF0000', audience: 'subscribers' },
  { key: 'Facebook', icon: Facebook, color: '#1877F2', audience: 'followers' },
];

const DURATIONS = [
  { months: 3, label: '3 months' },
  { months: 4, label: '4 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 0, label: 'Custom' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const addMonths = (dateStr, months) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

export default function Goals() {
  return (
    <div>
      <PageHeader title="Growth Goals" subtitle="Set a target per platform for each organization — pick the period (3 months, 6 months, a year…) and track live progress toward it." />
      <OrgPicker>{(orgId) => <Inner orgId={orgId} />}</OrgPicker>
    </div>
  );
}

function Inner({ orgId }) {
  const key = ['org-goals', orgId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => goalApi.list(orgId) });
  const [editing, setEditing] = useState(null); // platform key being edited

  if (isLoading) {
    return <div className="grid gap-5 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>;
  }
  const goals = data?.goals || [];
  const byPlatform = Object.fromEntries(goals.map((g) => [g.platform, g]));

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {PLATFORMS.map((p) => (
        <PlatformGoalCard
          key={p.key} orgId={orgId} platform={p} goal={byPlatform[p.key]}
          editing={editing === p.key}
          onEdit={() => setEditing(p.key)}
          onClose={() => setEditing(null)}
          queryKey={key}
        />
      ))}
    </div>
  );
}

function PlatformGoalCard({ orgId, platform, goal, editing, onEdit, onClose, queryKey }) {
  const { key, icon: Icon, color, audience } = platform;
  const qc = useQueryClient();

  const removeMut = useMutation({
    mutationFn: () => goalApi.remove(goal._id),
    onSuccess: () => { toast.success(`${key} goal removed`); qc.invalidateQueries({ queryKey }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <span className="flex items-center gap-2.5 font-bold text-slate-800 dark:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: color }}><Icon className="h-4.5 w-4.5" /></span>
          {key}
        </span>
        {goal && !editing && (
          <span className="flex items-center gap-1">
            <button onClick={onEdit} title="Edit goal" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"><PenLine className="h-4 w-4" /></button>
            <button onClick={() => window.confirm(`Remove the ${key} goal?`) && removeMut.mutate()} title="Remove goal" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
          </span>
        )}
      </div>

      <div className="p-5">
        {editing ? (
          <GoalForm orgId={orgId} platformKey={key} audience={audience} goal={goal} onClose={onClose} queryKey={queryKey} />
        ) : goal ? (
          <GoalProgress goal={goal} color={color} audience={audience} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Target className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400">No {key} goal yet for this organization.</p>
            <Button size="sm" onClick={onEdit}><Target className="h-4 w-4" /> Set a goal</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function GoalProgress({ goal, color, audience }) {
  const p = goal.progress || {};
  const now = Date.now();
  const start = new Date(goal.startDate).getTime();
  const end = new Date(goal.endDate).getTime();
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
  const timePct = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  const over = now > end;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs dark:bg-slate-800/50">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
          <CalendarRange className="h-3.5 w-3.5 text-brand-500" />
          {formatDate(goal.startDate)} → {formatDate(goal.endDate)}
        </span>
        <span className={cn('font-bold', over ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400')}>
          {over ? 'Period ended' : `${daysLeft} days left`} · {timePct}% of time elapsed
        </span>
      </div>

      {goal.targetFollowers > 0 && (
        <GoalBar icon={Users} label={`Total ${audience}`} current={p.currentFollowers || 0} target={goal.targetFollowers} color={color}
          sub={p.baselineFollowers != null ? `+${formatNumber(p.gainedFollowers || 0)} gained since start (from ${formatNumber(p.baselineFollowers)})` : null} />
      )}
      {goal.targetPosts > 0 && (
        <GoalBar icon={Send} label="Posts published in period" current={p.postsPublished || 0} target={goal.targetPosts} color="#0ea5e9" />
      )}
      {goal.note && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800/50">{goal.note}</p>}
      {!p.lastEntry && goal.targetFollowers > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">No analytics entries yet for this platform — progress will appear once metrics are synced or imported.</p>
      )}
    </div>
  );
}

function GoalBar({ icon: Icon, label, current, target, color, sub }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300"><Icon className="h-4 w-4" /> {label}</span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">{formatNumber(current)} / {formatNumber(target)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
        <span>{sub || ''}</span>
        <span className="font-semibold">{pct}%</span>
      </div>
    </div>
  );
}

function GoalForm({ orgId, platformKey, audience, goal, onClose, queryKey }) {
  const qc = useQueryClient();
  const initialMonths = goal ? 0 : 3; // editing an existing goal starts on its stored dates
  const [form, setForm] = useState({
    targetFollowers: goal?.targetFollowers || '',
    targetPosts: goal?.targetPosts || '',
    startDate: goal ? String(goal.startDate).slice(0, 10) : todayStr(),
    endDate: goal ? String(goal.endDate).slice(0, 10) : addMonths(todayStr(), 3),
    note: goal?.note || '',
  });
  const [months, setMonths] = useState(initialMonths);

  const pickDuration = (m) => {
    setMonths(m);
    if (m > 0) setForm((f) => ({ ...f, endDate: addMonths(f.startDate, m) }));
  };
  const setStart = (v) => setForm((f) => ({ ...f, startDate: v, endDate: months > 0 ? addMonths(v, months) : f.endDate }));

  const saveMut = useMutation({
    mutationFn: () => goalApi.set({
      organization: orgId, platform: platformKey,
      targetFollowers: Number(form.targetFollowers) || 0,
      targetPosts: Number(form.targetPosts) || 0,
      startDate: form.startDate, endDate: form.endDate, note: form.note,
    }),
    onSuccess: () => { toast.success(`${platformKey} goal saved`); qc.invalidateQueries({ queryKey }); onClose(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save goal'),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label={`Target ${audience} (total)`} type="number" min="0" value={form.targetFollowers}
          onChange={(e) => setForm({ ...form, targetFollowers: e.target.value })} placeholder="e.g. 10000" />
        <Input label="Target posts in period" type="number" min="0" value={form.targetPosts}
          onChange={(e) => setForm({ ...form, targetPosts: e.target.value })} placeholder="e.g. 40" />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Period</label>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button key={d.label} type="button" onClick={() => pickDuration(d.months)}
              className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                months === d.months
                  ? 'border-transparent bg-brand-600 text-white shadow-soft'
                  : 'border-slate-200 text-slate-500 hover:border-brand-300 dark:border-slate-700 dark:text-slate-300')}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Starts" type="date" value={form.startDate} onChange={(e) => setStart(e.target.value)} />
        <Input label="Ends" type="date" value={form.endDate} min={form.startDate} disabled={months > 0}
          onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
      </div>

      <textarea className="input-base min-h-[52px]" placeholder="Note (optional) — e.g. campaign focus for this period"
        value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />

      <div className="flex items-center gap-2">
        <Button type="submit" loading={saveMut.isPending}><Save className="h-4 w-4" /> Save goal</Button>
        <Button type="button" variant="ghost" onClick={onClose}><X className="h-4 w-4" /> Cancel</Button>
      </div>
    </form>
  );
}
