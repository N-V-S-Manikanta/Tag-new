import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Inbox, Search, Images as ImagesIcon, Check, X, Plus, Trash2, Hash,
  MessageSquareWarning, Building2, Clock, Play,
} from 'lucide-react';
import { approvalApi, organizationApi } from '../api/endpoints.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, Input, Select, Avatar, Skeleton, EmptyState } from '../components/ui/primitives.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { formatDate, formatDateTime, timeAgo, cn, isVideo } from '../lib/utils.js';

const STATUS_OPTS = [
  { value: 'REVIEW', label: 'Needs review' },
  { value: 'All', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESUBMITTED', label: 'Resubmitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'POSTED', label: 'Posted' },
];
const PLATFORMS = ['All', 'LinkedIn', 'Instagram', 'YouTube', 'Facebook'];

export const STATUS_STYLES = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  RESUBMITTED: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  POSTED: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};
const StatusPill = ({ status, className }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide', STATUS_STYLES[status] || 'bg-slate-100 text-slate-600', className)}>{status}</span>
);

// What a rejection feedback point asks the submitter to change.
const FEEDBACK_CATEGORIES = ['Image', 'Content', 'Other', 'Reject'];
const FEEDBACK_CATEGORY_STYLES = {
  Image: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  Content: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Other: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  Reject: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};
function FeedbackCategoryTag({ category }) {
  if (!category) return null;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', FEEDBACK_CATEGORY_STYLES[category] || FEEDBACK_CATEGORY_STYLES.Other)}>
      {category === 'Reject' ? 'Not usable' : category}
    </span>
  );
}

export default function Approvals() {
  const [filters, setFilters] = useState({ search: '', status: 'REVIEW', platform: 'All', organizationId: '' });
  const [openId, setOpenId] = useState(null);

  const { data: orgData } = useQuery({ queryKey: ['organizations', 'picker'], queryFn: () => organizationApi.list() });
  const orgs = orgData?.organizations || [];

  // Strip empty filters so they aren't sent as params (keeps "all orgs" behaviour).
  const params = { ...filters, limit: 60 };
  Object.keys(params).forEach((k) => { if (params[k] === '' || params[k] === 'All') delete params[k]; });

  const { data, isLoading } = useQuery({ queryKey: ['admin-approvals', filters], queryFn: () => approvalApi.list(params) });
  const requests = data?.requests || [];

  return (
    <div>
      <PageHeader title="Approvals" subtitle="As the head of all organizations, review, approve or request changes to content from any organization." />

      {/* Filters */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search title or caption..." className="pl-9" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <Select value={filters.organizationId} onChange={(e) => setFilters({ ...filters, organizationId: e.target.value })}>
          <option value="">All organizations</option>
          {orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
        </Select>
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        <Select value={filters.platform} onChange={(e) => setFilters({ ...filters, platform: e.target.value })}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p === 'All' ? 'All platforms' : p}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : requests.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing to show" description="No approval requests match these filters. Try 'All statuses' or a different organization." />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-400">{data.total} request{data.total === 1 ? '' : 's'}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {requests.map((r) => (
              <Card key={r._id} className="group cursor-pointer overflow-hidden transition hover:shadow-glow" onClick={() => setOpenId(r._id)}>
                <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {r.images?.[0] ? (
                    isVideo(r.images[0]) ? (
                      <>
                        <video src={r.images[0].url} className="h-full w-full object-cover" muted />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25"><Play className="h-9 w-9 text-white" /></span>
                      </>
                    ) : (
                      <img src={r.images[0].url} alt={r.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center"><ImagesIcon className="h-10 w-10 text-slate-300" /></div>
                  )}
                  <StatusPill status={r.status} className="absolute right-2 top-2" />
                  {r.images?.length > 1 && <span className="absolute bottom-2 right-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-xs font-medium text-white">+{r.images.length - 1}</span>}
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.organization?.color || '#7c3aed' }} />
                      {r.organization?.name || '—'}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="truncate font-semibold text-slate-800 dark:text-white">{r.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{r.caption}</p>
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <Avatar src={r.createdBy?.avatar} name={r.createdBy?.name} size="sm" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{r.createdBy?.name}</span>
                    <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{r.platform}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {openId && <ApprovalDetailModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ApprovalDetailModal({ id, onClose }) {
  const qc = useQueryClient();
  const [activeImg, setActiveImg] = useState(0);
  const [rejectOpen, setRejectOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['admin-approval', id], queryFn: () => approvalApi.get(id) });
  const r = data?.request;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-approval', id] });
    qc.invalidateQueries({ queryKey: ['admin-approvals'] });
  };
  const approveMut = useMutation({
    mutationFn: () => approvalApi.approve(id),
    onSuccess: () => { toast.success('Content approved'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const images = [...(r?.images || [])].sort((a, b) => a.order - b.order);
  const latestReview = r?.reviews?.[r.reviews.length - 1];
  const canDecide = r && (r.status === 'PENDING' || r.status === 'RESUBMITTED');

  return (
    <>
      <Modal open onClose={onClose} title={r?.title || 'Approval request'} size="lg">
        {isLoading || !r ? (
          <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-24" /></div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={r.status} />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Building2 className="h-3.5 w-3.5" /> {r.organization?.name || '—'}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{r.platform}</span>
              {r.aspectRatio && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Ratio {r.aspectRatio}</span>}
              <span className="text-xs text-slate-400">Submitted {formatDateTime(r.createdAt)}</span>
            </div>

            {/* Gallery */}
            <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="relative flex aspect-video items-center justify-center bg-slate-100 dark:bg-slate-800">
                {images[activeImg]
                  ? (isVideo(images[activeImg])
                      ? <video src={images[activeImg].url} controls className="h-full w-full object-contain" />
                      : <img src={images[activeImg].url} alt="" className="h-full w-full object-contain" />)
                  : <span className="text-slate-300">No media</span>}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {images.map((img, i) => (
                    <button key={img._id} onClick={() => setActiveImg(i)} className={cn('relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition', i === activeImg ? 'ring-brand-500' : 'ring-transparent opacity-70 hover:opacity-100')}>
                      {isVideo(img)
                        ? <><video src={img.url} className="h-full w-full object-cover" muted /><span className="absolute inset-0 flex items-center justify-center bg-black/30"><Play className="h-4 w-4 text-white" /></span></>
                        : <img src={img.url} alt="" className="h-full w-full object-cover" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Submitter */}
            <div className="flex items-center gap-3">
              <Avatar src={r.createdBy?.avatar} name={r.createdBy?.name} />
              <div><p className="font-semibold text-slate-700 dark:text-slate-200">{r.createdBy?.name}</p><p className="text-xs text-slate-400">{r.createdBy?.email}</p></div>
            </div>

            {/* Content */}
            {r.caption && <Field label="Caption" value={r.caption} />}
            {r.description && <Field label="Description" value={r.description} />}
            {r.hashtags?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Hashtags</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.hashtags.map((h, i) => <span key={i} className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/10"><Hash className="h-3 w-3" />{h}</span>)}
                </div>
              </div>
            )}

            {/* Latest feedback */}
            {latestReview && (
              <div className="rounded-xl border border-rose-200 p-4 dark:border-rose-500/30">
                <div className="mb-2 flex items-center gap-2 text-rose-600"><MessageSquareWarning className="h-4 w-4" /><h4 className="text-sm font-bold">Latest feedback</h4></div>
                <ol className="space-y-1.5">
                  {latestReview.feedbackPoints.map((fp, i) => {
                    const text = typeof fp === 'string' ? fp : fp.text;
                    const category = typeof fp === 'string' ? null : fp.category;
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600 dark:bg-rose-500/20">{i + 1}</span>
                        <span className="flex flex-wrap items-center gap-2"><FeedbackCategoryTag category={category} />{text}</span>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-2 text-xs text-slate-400">Reviewed {timeAgo(latestReview.reviewedAt)}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              {canDecide ? (
                <>
                  <Button variant="success" loading={approveMut.isPending} onClick={() => approveMut.mutate()}><Check className="h-4 w-4" /> Approve</Button>
                  <Button variant="danger" onClick={() => setRejectOpen(true)}><X className="h-4 w-4" /> Request changes / Reject</Button>
                </>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500 dark:bg-slate-800/50">
                  <Clock className="h-4 w-4" /> This request is {r.status.toLowerCase()} — no action needed.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {rejectOpen && <RejectModal id={id} onClose={() => setRejectOpen(false)} onDone={() => { setRejectOpen(false); invalidate(); }} />}
    </>
  );
}

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{value}</p>
  </div>
);

function RejectModal({ id, onClose, onDone }) {
  const [points, setPoints] = useState([{ text: '', category: 'Content' }]);
  const [loading, setLoading] = useState(false);
  const update = (i, patch) => setPoints(points.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const submit = async () => {
    const clean = points.map((p) => ({ text: p.text.trim(), category: p.category })).filter((p) => p.text);
    if (clean.length === 0) { toast.error('Add at least one feedback point'); return; }
    setLoading(true);
    try {
      await approvalApi.reject(id, clean);
      toast.success('Sent back with feedback');
      onDone();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Request changes / Reject">
      <p className="mb-4 text-sm text-slate-400">For each point, choose what needs changing — <span className="font-medium">Image</span> or <span className="font-medium">Content</span> — and describe it. Pick <span className="font-medium">Not usable</span> if the content can't be fixed and should be rejected outright.</p>
      <div className="space-y-2.5">
        {points.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600 dark:bg-rose-500/20">{i + 1}</span>
            <select className="input-base h-11 w-32 shrink-0 cursor-pointer py-0" value={p.category} onChange={(e) => update(i, { category: e.target.value })}>
              {FEEDBACK_CATEGORIES.map((c) => <option key={c} value={c}>{c === 'Reject' ? 'Not usable' : c}</option>)}
            </select>
            <Input value={p.text} onChange={(e) => update(i, { text: e.target.value })} placeholder={p.category === 'Image' ? 'What to change in the image…' : p.category === 'Reject' ? 'Why it can’t be used…' : 'What to change…'} />
            {points.length > 1 && <button onClick={() => setPoints(points.filter((_, idx) => idx !== i))} className="mt-1.5 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPoints([...points, { text: '', category: 'Content' }])}><Plus className="h-4 w-4" /> Add another point</Button>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={submit}>Send back</Button>
      </div>
    </Modal>
  );
}
