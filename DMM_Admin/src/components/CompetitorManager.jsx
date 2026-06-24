import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Users, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import { competitorApi } from '../api/endpoints.js';
import { Button } from './ui/Button.jsx';
import { Card, Input, Skeleton, EmptyState } from './ui/primitives.jsx';
import { formatNumber } from '../lib/utils.js';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#f97316'];
const blankForm = { name: '', handle: '', followers: '', newFollowers: '', postsLast30Days: '', engagementRate: '' };

export default function CompetitorManager({ orgId, platform }) {
  const qc = useQueryClient();
  const queryKey = ['competitors', orgId, platform];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => competitorApi.list(platform, orgId) });

  const [editing, setEditing] = useState(null); // null | 'new' | competitor._id
  const [form, setForm] = useState(blankForm);

  const labels = data?.labels || {};
  const fields = data?.fields || [];
  const pct = new Set(data?.percentFields || []);
  const own = data?.own;
  const competitors = data?.competitors || [];

  // Combined, ranked rows (you + competitors) for the chart & table.
  const rows = [own, ...competitors].filter(Boolean).sort((a, b) => (b.followers || 0) - (a.followers || 0));
  const chartData = rows.map((r, i) => ({ name: r.isSelf ? `${r.name} (You)` : r.name, value: r.followers || 0, self: !!r.isSelf, color: r.color || COLORS[i % COLORS.length] }));

  const reset = () => { setEditing(null); setForm(blankForm); };
  const invalidate = () => qc.invalidateQueries({ queryKey });

  const saveMut = useMutation({
    mutationFn: ({ id, body }) => (id ? competitorApi.update(id, body) : competitorApi.create(body)),
    onSuccess: () => { toast.success('Competitor saved'); invalidate(); reset(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });
  const delMut = useMutation({
    mutationFn: (id) => competitorApi.remove(id),
    onSuccess: () => { toast.success('Competitor removed'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const startAdd = () => { setForm(blankForm); setEditing('new'); };
  const startEdit = (c) => {
    setForm({ name: c.name, handle: c.handle || '', followers: c.followers ?? '', newFollowers: c.newFollowers ?? '', postsLast30Days: c.postsLast30Days ?? '', engagementRate: c.engagementRate ?? '' });
    setEditing(c._id);
  };
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Competitor name is required');
    const body = { platform, organization: orgId, ...form };
    saveMut.mutate({ id: editing === 'new' ? null : editing, body });
  };

  const fmt = (v, key) => (pct.has(key) ? `${Number(v || 0).toFixed(1)}%` : formatNumber(v || 0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Track {platform} competitors and benchmark them against your own organization. Numbers are entered manually.</p>
        {editing === null && <Button size="sm" onClick={startAdd}><Plus className="h-4 w-4" /> Add competitor</Button>}
      </div>

      {/* Add / edit form */}
      {editing !== null && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white">{editing === 'new' ? 'Add competitor' : 'Edit competitor'}</h3>
            <button onClick={reset} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input label="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Corp" />
              <Input label="Handle / page (optional)" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="e.g. @acme or linkedin.com/company/acme" />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {fields.map((f) => (
                <Input key={f} label={labels[f]} type="number" min="0" step={pct.has(f) ? '0.1' : '1'}
                  value={form[f] ?? ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} placeholder="0" />
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={saveMut.isPending}><Save className="h-4 w-4" /> Save competitor</Button>
              <Button type="button" variant="outline" onClick={reset}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-80" />
      ) : competitors.length === 0 && editing === null ? (
        <EmptyState icon={Users} title="No competitors yet" description={`Add ${platform} competitors to benchmark your follower growth, posting cadence and engagement against them.`}
          action={<Button size="sm" onClick={startAdd}><Plus className="h-4 w-4" /> Add competitor</Button>} />
      ) : (
        <>
          {/* Followers comparison chart */}
          {rows.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-4 font-bold text-slate-800 dark:text-white">Followers — you vs. competitors ({platform})</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 46)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} formatter={(v) => formatNumber(v)} cursor={{ fill: 'rgba(124,58,237,0.06)' }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Followers">
                    {chartData.map((d, i) => <Cell key={i} fill={d.self ? '#7c3aed' : d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Ranked table */}
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                  <th className="px-5 py-3 font-semibold">#</th>
                  <th className="px-5 py-3 font-semibold">Company</th>
                  {fields.map((f) => <th key={f} className="px-5 py-3 font-semibold">{labels[f]}</th>)}
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {rows.map((r, i) => (
                  <tr key={r._id || 'self'} className={r.isSelf ? 'bg-brand-50/50 dark:bg-brand-500/5' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'}>
                    <td className="px-5 py-3 font-bold text-slate-400">{i + 1}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.isSelf ? '#7c3aed' : (r.color || COLORS[i % COLORS.length]) }} />
                        {r.name}
                        {r.isSelf && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700 dark:bg-brand-900 dark:text-brand-200">You</span>}
                        {r.handle && <span className="text-xs font-normal text-slate-400">{r.handle}</span>}
                      </span>
                    </td>
                    {fields.map((f) => (
                      <td key={f} className="px-5 py-3 font-semibold text-slate-700 dark:text-slate-200">{fmt(r[f], f)}</td>
                    ))}
                    <td className="px-5 py-3 text-right">
                      {!r.isSelf && (
                        <div className="inline-flex gap-1">
                          <button onClick={() => startEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800" title="Edit"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => { if (window.confirm(`Remove competitor "${r.name}"?`)) delMut.mutate(r._id); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" title="Remove"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
