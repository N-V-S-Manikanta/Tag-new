import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Check, X, Plus, Trash2, Hash, Play, Send, Paperclip, Inbox,
  CheckCircle2, RefreshCw, MessageSquareWarning, FileText, Rocket, Images as ImagesIcon,
  UserCheck, Palette, Truck, Route, Sparkles,
} from 'lucide-react';
import { approvalApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/authStore.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, Input, Avatar, Skeleton, EmptyState } from '../components/ui/primitives.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { formatDate, formatDateTime, timeAgo, cn, isVideo } from '../lib/utils.js';
import { StatusPill, FeedbackCategoryTag, FEEDBACK_CATEGORIES } from './Approvals.jsx';
import ReviewAssist from '../components/ReviewAssist.jsx';

export default function ApprovalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [rejectOpen, setRejectOpen] = useState(false);

  // Live-chat feel: poll every 3s while the page is open (paused when the tab
  // is in the background), so a reviewer sees the submitter's replies and
  // status changes without refreshing.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-approval', id],
    queryFn: () => approvalApi.get(id),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });
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
  const deleteMut = useMutation({
    mutationFn: () => approvalApi.remove(id),
    onSuccess: () => {
      toast.success('Request deleted');
      qc.invalidateQueries({ queryKey: ['admin-approvals'] });
      navigate('/approvals');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-6 h-9 w-72" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2"><Skeleton className="h-44" /><Skeleton className="h-64" /><Skeleton className="h-80" /></div>
          <Skeleton className="h-[70vh]" />
        </div>
      </div>
    );
  }
  if (isError || !r) {
    return (
      <div>
        <PageHeader title="Approvals" />
        <EmptyState icon={Inbox} title="Request not found"
          description="This approval request may have been deleted."
          action={<Button variant="outline" onClick={() => navigate('/approvals')}><ArrowLeft className="h-4 w-4" /> Back to approvals</Button>} />
      </div>
    );
  }

  const canDecide = !!user?.isSuperAdmin && (r.status === 'PENDING' || r.status === 'RESUBMITTED');

  return (
    <div>
      <Link to="/approvals" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Back to approvals
      </Link>

      {/* Header: title, status + reviewer actions */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">{r.title}</h1>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide',
              r.type === 'DESIGN'
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300')}>
              {r.type === 'DESIGN' ? <><Palette className="h-3 w-3" /> Design</> : <><Send className="h-3 w-3" /> Post</>}
            </span>
            <StatusPill status={r.status} />
          </div>
          <p className="mt-1 text-sm text-slate-400">Request #{String(r._id).slice(-6).toUpperCase()} · Updated {formatDateTime(r.updatedAt)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canDecide && (
            <>
              <Button variant="success" loading={approveMut.isPending} onClick={() => approveMut.mutate()}><Check className="h-4 w-4" /> Approve</Button>
              <Button variant="danger" onClick={() => setRejectOpen(true)}><X className="h-4 w-4" /> Request changes</Button>
            </>
          )}
          <Button variant="outline" loading={deleteMut.isPending}
            className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            onClick={() => { if (window.confirm('Delete this request and all its media? This cannot be undone.')) deleteMut.mutate(); }}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <LifecycleCard r={r} />
          {r.type === 'DESIGN' && <RoutingCard r={r} user={user} onChanged={invalidate} />}
          {/* Pre-approval AI quality check — posts awaiting a decision only */}
          {r.type !== 'DESIGN' && canDecide && <ReviewAssist approvalId={id} />}
          <DetailsCard r={r} />
          <GalleryCard r={r} />
        </div>
        <ActivityCard r={r} />
      </div>

      {rejectOpen && <RejectModal id={id} onClose={() => setRejectOpen(false)} onDone={() => { setRejectOpen(false); invalidate(); }} />}
    </div>
  );
}

/* ---------------------------------- Lifecycle --------------------------------- */

const STEP_CIRCLE = {
  done: 'bg-emerald-500 text-white',
  warn: 'bg-amber-500 text-white',
  current: 'bg-brand-600 text-white',
  upcoming: 'border-2 border-slate-200 bg-transparent text-slate-400 dark:border-slate-700',
};

function LifecycleCard({ r }) {
  const isDesign = r.type === 'DESIGN';
  const resubmits = r.resubmitCount || 0;
  const terminal = r.status === 'POSTED' || r.status === 'DELIVERED';

  // Furthest stage reached (1-based). DESIGN opens with an "In design" stage
  // (coordinator raised, designer working) and ends when the approved design is
  // either delivered to the coordinator or posted by a handler. POST starts at
  // review and ends at posted.
  // 1-based furthest stage on a shared scale: 1 in-design (design only) ·
  // 2 review · 3 approved · 4 terminal (delivered / posted). POST skips stage 1
  // because a submitted post is already in review.
  const stageIdx = isDesign
    ? (terminal ? 4 : r.status === 'APPROVED' ? 3 : r.status === 'IN_DESIGN' ? 1 : 2)
    : (terminal ? 4 : r.status === 'APPROVED' ? 3 : 2);

  const reviewStep = r.status === 'REJECTED'
    ? { label: 'Changes requested', sub: `${resubmits} resubmission${resubmits === 1 ? '' : 's'} so far`, state: 'warn' }
    : r.status === 'RESUBMITTED'
      ? { label: 'Back in review', sub: formatDate(r.resubmittedAt), state: 'current' }
      : stageIdx > 2
        ? { label: 'In review', sub: 'Review complete', state: 'done' }
        : stageIdx === 2
          ? { label: 'In review', sub: 'Awaiting decision', state: 'current' }
          : { label: 'In review', sub: '—', state: 'upcoming' };

  const approvedStep = stageIdx >= 3
    ? { label: 'Approved', sub: formatDate(r.approvedAt), state: stageIdx === 3 ? 'current' : 'done' }
    : { label: 'Approved', sub: '—', state: 'upcoming' };

  // DESIGN closes on a single routing step whose label reflects the outcome.
  const routeStep = r.status === 'DELIVERED'
    ? { label: 'Delivered', sub: `${r.createdBy?.name || 'Coordinator'} · ${formatDate(r.deliveredAt)}`, state: 'done' }
    : r.status === 'POSTED'
      ? { label: 'Posted', sub: `${r.assignedTo?.name ? `${r.assignedTo.name} · ` : ''}${formatDate(r.postedAt)}`, state: 'done' }
      : r.assignedTo
        ? { label: 'Allocated', sub: `${r.assignedTo?.name} · awaiting post`, state: 'current' }
        : { label: 'Delivered / Posted', sub: '—', state: 'upcoming' };

  const steps = isDesign
    ? [
        { label: 'In design', sub: `Raised ${formatDate(r.createdAt)}`, state: stageIdx > 1 ? 'done' : 'current' },
        reviewStep,
        approvedStep,
        routeStep,
      ]
    : [
        { label: 'Submitted', sub: formatDate(r.createdAt), state: 'done' },
        reviewStep,
        approvedStep,
        stageIdx === 4
          ? { label: 'Posted', sub: formatDate(r.postedAt), state: 'done' }
          : { label: 'Posted', sub: '—', state: 'upcoming' },
      ];
  const percent = Math.round((stageIdx / steps.length) * 100);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 dark:text-white">Approval lifecycle</h3>
        <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{percent}% complete</span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <div className={cn('grid grid-cols-2 gap-4', steps.length === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4')}>
        {steps.map((s, i) => (
          <div key={i} className="text-center">
            <span className={cn('mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold', STEP_CIRCLE[s.state])}>
              {s.state === 'done' ? <Check className="h-4 w-4" /> : s.state === 'warn' ? <MessageSquareWarning className="h-4 w-4" /> : i + 1}
            </span>
            <p className={cn('mt-2 text-xs font-bold', s.state === 'upcoming' ? 'text-slate-400' : s.state === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200')}>{s.label}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{s.sub}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------------- Design routing: allocate or deliver ---------------------- */

// After a design is APPROVED, a super admin routes it: either allocate it to a
// social handler who will post it, or deliver it back to the coordinator who
// raised the brief. Both paths are always available; the coordinator's
// `needsPosting` hint only decides which one we visually lead with.
function RoutingCard({ r, user, onChanged }) {
  const isSuperAdmin = !!user?.isSuperAdmin;
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [delivering, setDelivering] = useState(false);

  const delivered = r.status === 'DELIVERED';
  const allocated = !!r.assignedTo; // allocated (APPROVED + handler) or already POSTED
  const canRoute = isSuperAdmin && r.status === 'APPROVED' && !allocated && !delivered;

  // Nothing to route until the design is approved (or already routed).
  if (!canRoute && !allocated && !delivered) return null;

  const deliver = async () => {
    if (!window.confirm(`Deliver this approved design to ${r.createdBy?.name || 'the coordinator'}? This marks the request complete.`)) return;
    setDelivering(true);
    try {
      await approvalApi.deliver(r._id);
      toast.success('Design delivered to the coordinator');
      onChanged();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delivery failed');
    } finally {
      setDelivering(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
          <Route className="h-4 w-4 text-violet-500" /> Route this design
        </h3>
        {r.needsPosting && canRoute && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <Sparkles className="h-3 w-3" /> Coordinator wants this posted
          </span>
        )}
      </div>

      {/* Delivered — terminal */}
      {delivered && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-500/20 dark:bg-green-500/10">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">Delivered to {r.createdBy?.name || 'coordinator'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatDate(r.deliveredAt)}{r.deliveredBy?.name ? ` · by ${r.deliveredBy.name}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Allocated to a social handler (awaiting post, or already posted) */}
      {!delivered && allocated && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
          <div className="flex items-center gap-3">
            <Avatar src={r.assignedTo?.avatar} name={r.assignedTo?.name} size="md" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">Allocated to {r.assignedTo?.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {r.status === 'POSTED' ? `Posted ${formatDate(r.postedAt)}` : 'Awaiting post'}
                {r.assignedBy?.name ? ` · by ${r.assignedBy.name}` : ''}
              </p>
            </div>
          </div>
          <StatusPill status={r.status} />
        </div>
      )}

      {/* Approved & unrouted — the super admin picks a path */}
      {canRoute && (
        <>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            This design is approved. Send it to a social handler to post, or deliver it back to {r.createdBy?.name || 'the coordinator'}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <RouteOption
              icon={Send}
              title="Allocate to a social handler"
              desc="Hand the design to a handler who will publish it."
              cta="Choose handler"
              primary={!!r.needsPosting}
              onClick={() => setAllocateOpen(true)}
            />
            <RouteOption
              icon={Truck}
              title="Deliver to coordinator"
              desc={`Return the design to ${r.createdBy?.name || 'the coordinator'} — no posting needed.`}
              cta="Deliver"
              primary={!r.needsPosting}
              loading={delivering}
              onClick={deliver}
            />
          </div>
        </>
      )}

      {allocateOpen && (
        <AllocateModal request={r} onClose={() => setAllocateOpen(false)} onDone={() => { setAllocateOpen(false); onChanged(); }} />
      )}
    </Card>
  );
}

function RouteOption({ icon: Icon, title, desc, cta, primary, loading, onClick }) {
  return (
    <div className={cn(
      'flex flex-col rounded-xl border p-4',
      primary
        ? 'border-brand-200 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-500/10'
        : 'border-slate-200 dark:border-slate-800'
    )}>
      <span className={cn('mb-2 flex h-9 w-9 items-center justify-center rounded-lg',
        primary ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300')}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm font-semibold text-slate-800 dark:text-white">{title}</p>
      <p className="mb-3 mt-0.5 flex-1 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
      <Button variant={primary ? 'primary' : 'outline'} size="sm" loading={loading} onClick={onClick}>
        <Icon className="h-4 w-4" /> {cta}
      </Button>
    </div>
  );
}

// Single-select picker of the organization's social handlers for this platform.
function AllocateModal({ request, onClose, onDone }) {
  const organizationId = request.organization?._id || request.organization;
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['approval-handlers', organizationId, request.platform],
    queryFn: () => approvalApi.handlers(organizationId, request.platform),
    enabled: !!organizationId,
  });
  // Prefer handlers who own this org+platform; fall back to the wider list.
  const handlers = useMemo(() => {
    const merged = [...(data?.handlers || []), ...(data?.fallback || [])];
    const seen = new Set();
    return merged.filter((h) => {
      if (!h?._id || seen.has(h._id)) return false;
      seen.add(h._id);
      return true;
    });
  }, [data]);

  const submit = async () => {
    if (!selected) { toast.error('Choose a social handler'); return; }
    setSaving(true);
    try {
      await approvalApi.assign(request._id, selected);
      toast.success('Design allocated to the social handler');
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Allocation failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Allocate to a social handler">
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Pick the handler for <span className="font-semibold text-slate-700 dark:text-slate-200">{request.organization?.name || 'this organization'}</span> on <span className="font-semibold text-slate-700 dark:text-slate-200">{request.platform}</span>. They will post the approved design.
      </p>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : handlers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 dark:border-slate-700">
          No social handlers found for this organization and platform.
        </p>
      ) : (
        <div className="max-h-72 space-y-1.5 overflow-auto">
          {handlers.map((h) => (
            <button
              key={h._id}
              type="button"
              onClick={() => setSelected(h._id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                selected === h._id
                  ? 'border-brand-500 bg-brand-50 dark:border-brand-500/50 dark:bg-brand-500/10'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50'
              )}
            >
              <Avatar src={h.avatar} name={h.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{h.name}</p>
                {h.email && <p className="truncate text-xs text-slate-400">{h.email}</p>}
              </div>
              {selected === h._id && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button loading={saving} disabled={!selected} onClick={submit}><UserCheck className="h-4 w-4" /> Allocate</Button>
      </div>
    </Modal>
  );
}

/* --------------------------------- Post details -------------------------------- */

const DetailField = ({ label, children }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <div className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{children || '—'}</div>
  </div>
);

const PersonInline = ({ user }) => (user?.name ? (
  <span className="inline-flex items-center gap-2">
    <Avatar src={user?.avatar} name={user?.name} size="sm" className="h-6 w-6 text-[10px]" />
    {user.name}
  </span>
) : '—');

function DetailsCard({ r }) {
  const isDesign = r.type === 'DESIGN';
  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold text-slate-800 dark:text-white">{isDesign ? 'Design details' : 'Post details'}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {r.sourceDesign && (
          <DetailField label="Created from design">
            <Link to={`/approvals/${r.sourceDesign._id || r.sourceDesign}`}
              className="inline-flex items-center gap-1.5 font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
              <Palette className="h-3.5 w-3.5" /> {r.sourceDesign?.title || 'View design'}
            </Link>
          </DetailField>
        )}
        <DetailField label="Organization">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.organization?.color || '#7c3aed' }} />
            {r.organization?.name || '—'}
          </span>
        </DetailField>
        <DetailField label="Platform">{r.platform}</DetailField>
        <DetailField label="Aspect ratio">{r.aspectRatio}</DetailField>
        {isDesign ? (
          <>
            <DetailField label="Coordinator"><PersonInline user={r.createdBy} /></DetailField>
            <DetailField label="Designer"><PersonInline user={r.designer} /></DetailField>
            <DetailField label="Needs posting">
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                r.needsPosting
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>
                {r.needsPosting ? 'Yes — should be posted' : 'No'}
              </span>
            </DetailField>
            <DetailField label="Raised on">{formatDateTime(r.createdAt)}</DetailField>
          </>
        ) : (
          <>
            <DetailField label="Submitted by"><PersonInline user={r.createdBy} /></DetailField>
            <DetailField label="Submitted on">{formatDateTime(r.createdAt)}</DetailField>
          </>
        )}
        <DetailField label="Resubmissions">{String(r.resubmitCount || 0)}</DetailField>
        {r.approvedBy?.name && <DetailField label="Approved by">{r.approvedBy.name}</DetailField>}
        {r.approvedAt && <DetailField label="Approved on">{formatDateTime(r.approvedAt)}</DetailField>}
        {r.assignedTo?.name && <DetailField label="Allocated to"><PersonInline user={r.assignedTo} /></DetailField>}
        {r.postedBy?.name && <DetailField label="Posted by">{r.postedBy.name}</DetailField>}
        {r.postedAt && <DetailField label="Posted on">{formatDateTime(r.postedAt)}</DetailField>}
        {r.deliveredBy?.name && <DetailField label="Delivered by">{r.deliveredBy.name}</DetailField>}
        {r.deliveredAt && <DetailField label="Delivered on">{formatDateTime(r.deliveredAt)}</DetailField>}
      </div>
      {r.caption && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Caption</p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-700 dark:text-slate-200">{r.caption}</p>
        </div>
      )}
      {r.description && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-700 dark:text-slate-200">{r.description}</p>
        </div>
      )}
      {r.hashtags?.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hashtags</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.hashtags.map((h, i) => (
              <span key={i} className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/10"><Hash className="h-3 w-3" />{h}</span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------- Media gallery ------------------------------ */

function SectionHead({ icon: Icon, title, count, hint }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex min-w-0 items-center gap-2 font-bold text-slate-800 dark:text-white">
        <Icon className="h-4 w-4 shrink-0 text-slate-400" /> <span className="truncate">{title}</span>
        {hint && <span className="hidden shrink-0 text-xs font-normal text-slate-400 sm:inline">· {hint}</span>}
      </h3>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{count}</span>
    </div>
  );
}

// A single big preview + thumbnail strip. Reused per media group.
function MediaViewer({ items }) {
  const [active, setActive] = useState(0);
  const sorted = useMemo(() => [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [items]);
  const current = sorted[Math.min(active, Math.max(sorted.length - 1, 0))];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
      <div className="relative flex aspect-video items-center justify-center bg-slate-100 dark:bg-slate-800">
        {current
          ? (isVideo(current)
              ? <video src={current.url} controls className="h-full w-full object-contain" />
              : <img src={current.url} alt="" className="h-full w-full object-contain" />)
          : <span className="inline-flex items-center gap-2 text-slate-300 dark:text-slate-600"><ImagesIcon className="h-5 w-5" /> No media</span>}
      </div>
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3">
          {sorted.map((img, i) => (
            <button key={img._id || i} type="button" onClick={() => setActive(i)}
              className={cn('relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition', i === active ? 'ring-brand-500' : 'ring-transparent opacity-70 hover:opacity-100')}>
              {isVideo(img)
                ? <><video src={img.url} className="h-full w-full object-cover" muted /><span className="absolute inset-0 flex items-center justify-center bg-black/30"><Play className="h-4 w-4 text-white" /></span></>
                : <img src={img.url} alt="" className="h-full w-full object-cover" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryCard({ r }) {
  const images = r.images || [];
  const isDesign = r.type === 'DESIGN';
  const refs = images.filter((i) => i.kind === 'reference');
  const finals = images.filter((i) => i.kind !== 'reference'); // final + legacy/untagged

  // Posts (and legacy media without a kind) render as a single gallery.
  if (!isDesign || refs.length === 0) {
    return (
      <Card className="p-5">
        <SectionHead icon={ImagesIcon} title="Media" count={images.length} />
        <MediaViewer items={images} />
      </Card>
    );
  }

  // Designs split into the designer's final work and the coordinator's brief.
  return (
    <Card className="space-y-6 p-5">
      <div>
        <SectionHead icon={Palette} title="Final design" count={finals.length} hint="Designer's finished work" />
        {finals.length ? (
          <MediaViewer items={finals} />
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 dark:border-slate-700">
            No final design uploaded yet.
          </p>
        )}
      </div>
      <div>
        <SectionHead icon={Paperclip} title="Reference" count={refs.length} hint="From the coordinator's brief" />
        <MediaViewer items={refs} />
      </div>
    </Card>
  );
}

/* ------------------------------------ Activity --------------------------------- */

// Icon for a durable status-change event line, matched on the event text.
// Order matters: 'resubmitted…' also contains 'submitted'.
const EVENT_META = [
  { match: 'resubmitted', icon: RefreshCw, cls: 'text-sky-500' },
  { match: 'requested changes', icon: MessageSquareWarning, cls: 'text-amber-500' },
  { match: 'approved', icon: CheckCircle2, cls: 'text-emerald-500' },
  { match: 'delivered', icon: Truck, cls: 'text-green-500' },
  { match: 'allocated', icon: UserCheck, cls: 'text-violet-500' },
  { match: 'posted', icon: Rocket, cls: 'text-violet-500' },
  { match: 'submitted', icon: FileText, cls: 'text-slate-400' },
];
const EVENT_DEFAULT = { icon: FileText, cls: 'text-slate-400' };

function EventLine({ item }) {
  const meta = EVENT_META.find((m) => (item.text || '').includes(m.match)) || EVENT_DEFAULT;
  const Icon = meta.icon;
  return (
    <div className="flex items-start justify-center gap-1.5 px-2 text-center text-xs text-slate-400">
      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', meta.cls)} />
      <span><span className="font-semibold text-slate-500 dark:text-slate-300">{item.author?.name || 'Someone'}</span> {item.text} · {timeAgo(item.createdAt)}</span>
    </div>
  );
}

function FeedItem({ item, own }) {
  if (item.kind === 'event') return <EventLine item={item} />;

  if (item.kind === 'feedback') {
    return (
      <div className="max-w-[90%]">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{item.author?.name || 'Reviewer'}</span>
          <span className="text-[10px] text-slate-400">{timeAgo(item.createdAt)}</span>
        </div>
        <div className="rounded-xl rounded-tl-sm border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex flex-wrap items-center gap-2">
            <FeedbackCategoryTag category={item.category} />
            <p className="min-w-0 break-words text-sm text-slate-700 dark:text-slate-200">{item.text}</p>
          </div>
        </div>
      </div>
    );
  }

  const attachments = item.attachments || [];
  return (
    <div className={cn('flex flex-col', own ? 'items-end' : 'items-start')}>
      <div className="mb-1 flex items-center gap-2">
        {!own && <Avatar src={item.author?.avatar} name={item.author?.name} size="sm" className="h-6 w-6 text-[10px]" />}
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{own ? 'You' : item.author?.name || 'Someone'}</span>
        <span className="text-[10px] text-slate-400">{timeAgo(item.createdAt)}</span>
      </div>
      <div className={cn('max-w-[90%] rounded-xl p-3', own ? 'rounded-tr-sm border border-brand-500/20 bg-brand-500/10' : 'rounded-tl-sm bg-slate-100 dark:bg-slate-800')}>
        {item.text && <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{item.text}</p>}
        {attachments.length > 0 && (
          <div className={cn('grid grid-cols-2 gap-1.5', item.text && 'mt-2')}>
            {attachments.map((a, i) =>
              a.mediaType === 'video' || isVideo(a) ? (
                <video key={i} src={a.url} controls className="h-24 w-full rounded-lg bg-black object-cover" />
              ) : (
                <button key={i} type="button" onClick={() => window.open(a.url, '_blank', 'noopener')} className="overflow-hidden rounded-lg">
                  <img src={a.url} alt={a.name || 'attachment'} className="h-24 w-full cursor-pointer object-cover transition hover:opacity-90" />
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityCard({ r }) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);
  const feedRef = useRef(null);

  // Normalize the thread: synthesize the initial "submitted" event (legacy
  // requests lack event rows) and default missing kinds by shape.
  const feed = useMemo(() => {
    const submitted = { _id: `${r._id}-created`, kind: 'event', author: r.createdBy, text: 'submitted this request', createdAt: r.createdAt };
    const rows = (r.comments || []).map((c) => ({ ...c, kind: c.kind || (c.category ? 'feedback' : 'message') }));
    return [submitted, ...rows];
  }, [r]);

  // Keep the newest entry in view on load and whenever something arrives.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed.length]);

  const sendMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('text', text.trim());
      files.forEach((f) => fd.append('files', f));
      return approvalApi.comment(r._id, fd);
    },
    onSuccess: () => {
      setText(''); setFiles([]);
      qc.invalidateQueries({ queryKey: ['admin-approval', r._id] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to send'),
  });

  const addFiles = (list) => {
    const incoming = Array.from(list || []);
    if (files.length + incoming.length > 6) toast.error('Up to 6 attachments per message');
    setFiles([...files, ...incoming].slice(0, 6));
  };
  const canSend = (text.trim() !== '' || files.length > 0) && !sendMut.isPending;

  return (
    <Card className="flex max-h-[70vh] flex-col self-start lg:sticky lg:top-20">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="font-bold text-slate-800 dark:text-white">Activity</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{feed.length}</span>
      </div>

      <div ref={feedRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {feed.map((item, i) => (
          <FeedItem key={item._id || i} item={item} own={String(item.author?._id || item.author) === String(me?._id)} />
        ))}
      </div>

      {/* Composer: message the submitter, optionally with reference media */}
      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex max-w-[170px] items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} aria-label={`Remove ${f.name}`}
                  className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the submitter…"
            className="input-base flex-1 resize-none" />
          <button type="button" onClick={() => fileRef.current?.click()} title="Attach images or videos"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <Paperclip className="h-4 w-4" />
          </button>
          <Button size="icon" className="h-11 w-11 shrink-0" aria-label="Send message"
            disabled={!canSend} loading={sendMut.isPending} onClick={() => sendMut.mutate()}>
            {!sendMut.isPending && <Send className="h-4 w-4" />}
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      </div>
    </Card>
  );
}

/* ---------------------------------- Reject modal ------------------------------- */

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
