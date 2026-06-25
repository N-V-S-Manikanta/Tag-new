import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Target, Save, Users, Send } from 'lucide-react';
import { organizationApi } from '../api/endpoints.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import OrgPicker from '../components/OrgPicker.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, Input, Skeleton } from '../components/ui/primitives.jsx';
import { formatNumber } from '../lib/utils.js';

export default function Goals() {
  return (
    <div>
      <PageHeader title="Yearly Goals" subtitle="Set each organization's target for the year and track progress toward it." />
      <OrgPicker>{(orgId) => <Inner orgId={orgId} />}</OrgPicker>
    </div>
  );
}

function Inner({ orgId }) {
  const qc = useQueryClient();
  const key = ['org-goal', orgId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => organizationApi.goal(orgId) });

  const [form, setForm] = useState({ year: '', targetFollowers: '', targetPosts: '', note: '' });
  useEffect(() => {
    if (data?.goal) setForm({
      year: data.goal.year || new Date().getFullYear(),
      targetFollowers: data.goal.targetFollowers || '',
      targetPosts: data.goal.targetPosts || '',
      note: data.goal.note || '',
    });
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => organizationApi.setGoal(orgId, {
      year: Number(form.year) || new Date().getFullYear(),
      targetFollowers: Number(form.targetFollowers) || 0,
      targetPosts: Number(form.targetPosts) || 0,
      note: form.note,
    }),
    onSuccess: () => { toast.success('Goal saved'); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <Skeleton className="h-72" />;

  const progress = data?.progress || { currentFollowers: 0, currentPosts: 0 };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800 dark:text-white"><Target className="h-5 w-5 text-brand-600" /> Set the goal</h3>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
          <Input label="Target year" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder={String(new Date().getFullYear())} />
          <Input label="Target followers (total, all platforms)" type="number" min="0" value={form.targetFollowers} onChange={(e) => setForm({ ...form, targetFollowers: e.target.value })} placeholder="e.g. 50000" />
          <Input label="Target posts published this year" type="number" min="0" value={form.targetPosts} onChange={(e) => setForm({ ...form, targetPosts: e.target.value })} placeholder="e.g. 200" />
          <textarea className="input-base min-h-[60px]" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <Button type="submit" loading={saveMut.isPending}><Save className="h-4 w-4" /> Save goal</Button>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-bold text-slate-800 dark:text-white">Progress for {data?.year}</h3>
        <div className="space-y-6">
          <GoalBar icon={Users} label="Followers" current={progress.currentFollowers} target={data?.goal?.targetFollowers || 0} color="#7c3aed" />
          <GoalBar icon={Send} label="Posts published" current={progress.currentPosts} target={data?.goal?.targetPosts || 0} color="#0ea5e9" />
          {data?.goal?.note && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800/50">{data.goal.note}</p>}
          {!data?.goal?.targetFollowers && !data?.goal?.targetPosts && (
            <p className="text-sm text-slate-400">No targets set yet — fill the form to start tracking.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function GoalBar({ icon: Icon, label, current, target, color }) {
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
