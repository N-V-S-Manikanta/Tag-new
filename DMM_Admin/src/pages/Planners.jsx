import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ClipboardList, CalendarRange, CheckCircle2, XCircle, X, Trash2, Building2,
  Linkedin, Instagram, Youtube, Facebook, MessageSquareWarning,
} from 'lucide-react';
import { planApi, organizationApi } from '../api/endpoints.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, Skeleton, EmptyState } from '../components/ui/primitives.jsx';
import { cn, formatDate } from '../lib/utils.js';

const PLATFORM_ICON = { LinkedIn: Linkedin, Instagram: Instagram, YouTube: Youtube, Facebook: Facebook };
const PLATFORM_COLOR = { LinkedIn: '#0A66C2', Instagram: '#E1306C', YouTube: '#FF0000', Facebook: '#1877F2' };

const STATUS_META = {
  PENDING: { label: 'Awaiting review', cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
  RESUBMITTED: { label: 'Resubmitted', cls: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
};
const StatusChip = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.PENDING;
  return <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', m.cls)}>{m.label}</span>;
};

const FILTERS = [
  { key: 'REVIEW', label: 'Awaiting review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'All', label: 'All' },
];

export default function Planners() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('REVIEW');
  const [orgId, setOrgId] = useState('');
  const [openPlan, setOpenPlan] = useState(null);

  const { data: orgData } = useQuery({ queryKey: ['org-options'], queryFn: organizationApi.options });
  const { data, isLoading } = useQuery({
    queryKey: ['plans', status, orgId],
    queryFn: () => planApi.list({ status, organizationId: orgId || undefined, limit: 50 }),
  });
  const plans = data?.plans || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['plans'] });

  return (
    <div>
      <PageHeader title="Post Planners" subtitle="Review the posting plans users submit — approve a plan so the team can start creating, or send it back with feedback." />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setStatus(f.key)}
              className={cn('rounded-lg px-4 py-2 text-sm font-semibold transition',
                status === f.key ? 'bg-white text-brand-700 shadow-soft dark:bg-slate-900 dark:text-brand-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="input-base h-10 w-auto max-w-[220px] cursor-pointer">
          <option value="">All organizations</option>
          {(orgData?.organizations || []).map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : plans.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No plans here" description={status === 'REVIEW' ? 'No plans are waiting for review right now.' : 'No plans match this filter yet.'} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => <PlanCard key={p._id} plan={p} onOpen={() => setOpenPlan(p)} />)}
        </div>
      )}

      {openPlan && <PlanModal planId={openPlan._id} onClose={() => setOpenPlan(null)} onChanged={refresh} />}
    </div>
  );
}

function PlanCard({ plan, onOpen }) {
  const platforms = [...new Set((plan.items || []).map((i) => i.platform))];
  return (
    <Card onClick={onOpen} className="cursor-pointer p-5 transition-shadow hover:shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-bold leading-snug text-slate-800 dark:text-white">{plan.title}</h3>
        <StatusChip status={plan.status} />
      </div>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-400">
        <Building2 className="h-3.5 w-3.5" style={{ color: plan.organization?.color }} />
        {plan.organization?.name} · by {plan.createdBy?.name}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 font-semibold dark:bg-slate-800/60">
          <CalendarRange className="h-3.5 w-3.5 text-brand-500" />
          {formatDate(plan.startDate)} → {formatDate(plan.endDate)}
        </span>
        <span className="rounded-lg bg-slate-50 px-2 py-1 font-semibold dark:bg-slate-800/60">{plan.items?.length || 0} posts</span>
        <span className="flex items-center gap-1">
          {platforms.map((pl) => {
            const Icon = PLATFORM_ICON[pl];
            return Icon ? <Icon key={pl} className="h-3.5 w-3.5" style={{ color: PLATFORM_COLOR[pl] }} /> : null;
          })}
        </span>
      </div>
    </Card>
  );
}

function PlanModal({ planId, onClose, onChanged }) {
  const { data, isLoading } = useQuery({ queryKey: ['plan', planId], queryFn: () => planApi.get(planId) });
  const plan = data?.plan;
  const [rejecting, setRejecting] = useState(false);
  const [feedback, setFeedback] = useState('');

  const done = (msg) => { toast.success(msg); onChanged(); onClose(); };
  const approveMut = useMutation({
    mutationFn: () => planApi.approve(planId),
    onSuccess: () => done('Plan approved — the creator has been notified'),
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
  const rejectMut = useMutation({
    mutationFn: () => planApi.reject(planId, feedback),
    onSuccess: () => done('Plan rejected with feedback'),
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
  const removeMut = useMutation({
    mutationFn: () => planApi.remove(planId),
    onSuccess: () => done('Plan deleted'),
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const reviewable = plan && ['PENDING', 'RESUBMITTED'].includes(plan.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        {isLoading || !plan ? (
          <div className="p-6"><Skeleton className="h-64" /></div>
        ) : (
          <>
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">{plan.title}</h2>
                  <StatusChip status={plan.status} />
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {plan.organization?.name} · by {plan.createdBy?.name} · {formatDate(plan.startDate)} → {formatDate(plan.endDate)} · {plan.items.length} posts
                  {plan.resubmitCount > 0 && ` · resubmitted ${plan.resubmitCount}×`}
                </p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4 px-6 py-4">
              {plan.description && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">{plan.description}</p>}

              {plan.status === 'REJECTED' && plan.feedback && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                  <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><span className="font-bold">Feedback:</span> {plan.feedback}</span>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-slate-800">
                      <th className="px-4 py-2.5 font-bold">Date</th>
                      <th className="px-4 py-2.5 font-bold">Platform</th>
                      <th className="px-4 py-2.5 font-bold">Post</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                    {plan.items.map((it) => {
                      const Icon = PLATFORM_ICON[it.platform];
                      return (
                        <tr key={it._id}>
                          <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-300">{formatDate(it.date)}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                              {Icon && <Icon className="h-4 w-4" style={{ color: PLATFORM_COLOR[it.platform] }} />}
                              {it.platform}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-slate-800 dark:text-white">{it.title}</p>
                            {it.notes && <p className="text-xs text-slate-400">{it.notes}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {plan.reviewedBy && (
                <p className="text-xs text-slate-400">Reviewed by {plan.reviewedBy.name} on {formatDate(plan.reviewedAt)}</p>
              )}

              {rejecting ? (
                <div className="space-y-3 rounded-xl border border-rose-200 p-4 dark:border-rose-500/30">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">What should the creator change?</label>
                  <textarea autoFocus className="input-base min-h-[70px]" placeholder="e.g. Spread the Instagram posts out — 3 on the same day is too many…"
                    value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                  <div className="flex gap-2">
                    <Button variant="danger" loading={rejectMut.isPending} disabled={!feedback.trim()} onClick={() => rejectMut.mutate()}>
                      <XCircle className="h-4 w-4" /> Send rejection
                    </Button>
                    <Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 pb-2">
                  {reviewable && (
                    <>
                      <Button variant="success" loading={approveMut.isPending} onClick={() => approveMut.mutate()}>
                        <CheckCircle2 className="h-4 w-4" /> Approve plan
                      </Button>
                      <Button variant="outline" onClick={() => setRejecting(true)}
                        className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10">
                        <XCircle className="h-4 w-4" /> Reject with feedback
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" onClick={() => window.confirm('Delete this plan permanently?') && removeMut.mutate()}
                    className="ml-auto text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
