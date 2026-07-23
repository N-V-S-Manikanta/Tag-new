import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Check, X, Send, RefreshCw, Plus, Trash2, MessageSquareWarning,
  CheckCircle2, Hash, Play, Paperclip, FilePlus2, UserCheck, Palette,
  Upload, Download, Share2, PackageCheck, Truck,
} from 'lucide-react';
import { approvalApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/authStore.js';
import { Button } from '../components/ui/Button.jsx';
import { Card, Badge, Avatar, Skeleton, Input } from '../components/ui/primitives.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import FileDropzone from '../components/ui/FileDropzone.jsx';
import ReviewAssist from '../components/approvals/ReviewAssist.jsx';
import { cn, formatDate, formatDateTime, timeAgo, isVideo, statusLabel } from '../lib/utils.js';

const fileName = (u = '') => u.split('/').pop() || 'download';

export default function ApprovalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  // Approve/reject mirror the backend route gate: super admin only.
  const privileged = !!user?.isSuperAdmin;

  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  // Live-chat feel: poll every 3s while the page is open (paused when the tab
  // is in the background), so messages and status changes appear on both sides
  // without a manual refresh.
  const { data, isLoading } = useQuery({
    queryKey: ['approval', id],
    queryFn: () => approvalApi.get(id),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });
  const r = data?.request;
  const isViewer = !!user?.viewOnly; // Chairman — read-only
  const isOwner = r && String(r.createdBy?._id) === String(user?._id); // coordinator for a design
  const isDesigner = r && String(r.designer?._id || r.designer || '') === String(user?._id);
  const isHandler = r && String(r.assignedTo?._id || r.assignedTo || '') === String(user?._id);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['approval', id] }); qc.invalidateQueries({ queryKey: ['approvals'] }); };

  const approveMut = useMutation({
    mutationFn: () => approvalApi.approve(id),
    onSuccess: () => { toast.success('Content approved'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
  const postedMut = useMutation({
    mutationFn: () => approvalApi.markPosted(id),
    onSuccess: () => { toast.success('Marked as posted'); invalidate(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });
  const removeMut = useMutation({
    mutationFn: () => approvalApi.remove(id),
    onSuccess: () => { toast.success('Request deleted'); qc.invalidateQueries({ queryKey: ['approvals'] }); navigate('/approvals'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><div className="grid gap-5 lg:grid-cols-3"><Skeleton className="h-96 lg:col-span-2" /><Skeleton className="h-96" /></div></div>;
  if (!r) return <p className="text-slate-400">Request not found.</p>;

  const allImages = [...(r.images || [])].sort((a, b) => a.order - b.order);
  const referenceImages = allImages.filter((i) => i.kind === 'reference');
  const finalImages = allImages.filter((i) => i.kind !== 'reference');
  // Main gallery shows the finished work; a brief before submission shows references.
  const images = finalImages.length ? finalImages : allImages;
  // Clamp: a resubmission can shrink the list below the selected thumbnail index.
  const shownImg = images[Math.min(activeImg, images.length - 1)];
  const isDesign = r.type === 'DESIGN';
  const canReview = privileged && ['PENDING', 'RESUBMITTED'].includes(r.status);
  const canSubmitDesign = isDesign && isDesigner && r.status === 'IN_DESIGN';
  const canResubmit = r.status === 'REJECTED' && (isDesign ? isDesigner : isOwner);
  const canMarkPosted = r.status === 'APPROVED' && (isDesign ? isHandler : isOwner);
  const canDownloadFinal = finalImages.length > 0 && ['APPROVED', 'POSTED', 'DELIVERED'].includes(r.status) && (isOwner || privileged || isDesigner || isHandler);
  const canDelete = !isViewer && (isOwner || ['ADMIN', 'CEO'].includes(user?.role));

  return (
    <div>
      <button onClick={() => navigate('/approvals')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        <ArrowLeft className="h-4 w-4" /> Back to approvals
      </button>

      {/* Header: title + status + actions */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">{r.title}</h1>
            <Badge className={r.type === 'DESIGN'
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
              : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'}>
              {r.type === 'DESIGN' ? 'Design' : 'Post'}
            </Badge>
            <Badge status={r.status}>{statusLabel(r.status)}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-400">Request #{String(r._id).slice(-6).toUpperCase()} · Updated {formatDateTime(r.updatedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canReview && (
            <>
              <Button variant="success" loading={approveMut.isPending} onClick={() => approveMut.mutate()}><Check className="h-4 w-4" /> Approve</Button>
              <Button variant="danger" onClick={() => setRejectOpen(true)}><X className="h-4 w-4" /> Request changes</Button>
            </>
          )}
          {canSubmitDesign && (
            <Button onClick={() => setSubmitOpen(true)}><Upload className="h-4 w-4" /> Upload &amp; submit design</Button>
          )}
          {canResubmit && (
            <Button onClick={() => setResubmitOpen(true)}><RefreshCw className="h-4 w-4" /> Edit &amp; Resubmit</Button>
          )}
          {canMarkPosted && (
            <Button loading={postedMut.isPending} onClick={() => postedMut.mutate()}><Send className="h-4 w-4" /> Mark as Posted</Button>
          )}
          {canDelete && (
            <Button variant="outline" loading={removeMut.isPending}
              onClick={() => window.confirm(`Delete "${r.title}" permanently?`) && removeMut.mutate()}>
              <Trash2 className="h-4 w-4 text-rose-500" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: lifecycle + assignment + details + media */}
        <div className="space-y-5 lg:col-span-2">
          <LifecycleCard r={r} />
          {isDesign && (
            <RoutingCard r={r} user={user} privileged={privileged} isHandler={isHandler} onChanged={invalidate} />
          )}
          {/* Pre-approval AI quality check — posts awaiting a decision only */}
          {r.type !== 'DESIGN' && canReview && <ReviewAssist approvalId={id} />}
          <PostDetailsCard r={r} />

          {/* Media gallery — the finished work (or references before submission) */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {isDesign ? (finalImages.length ? 'Final design' : 'Reference') : 'Media'}
              </p>
              {canDownloadFinal && shownImg && (
                <a href={shownImg.url} download={fileName(shownImg.url)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              )}
            </div>
            <div className={`relative mt-2 aspect-video bg-slate-100 dark:bg-slate-800 ${shownImg && !isVideo(shownImg) ? 'cursor-zoom-in' : ''}`}
              onClick={() => { if (shownImg && !isVideo(shownImg)) setLightbox(shownImg.url); }}>
              {shownImg ? (
                isVideo(shownImg)
                  ? <video src={shownImg.url} controls className="h-full w-full object-contain" />
                  : <img src={shownImg.url} alt="" className="h-full w-full object-contain" />
              ) : <div className="flex h-full items-center justify-center text-slate-300">No media yet</div>}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {images.map((img, i) => (
                  <button key={img._id} onClick={() => setActiveImg(i)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === activeImg ? 'ring-brand-500' : 'ring-transparent opacity-70 hover:opacity-100'}`}>
                    {isVideo(img)
                      ? <><video src={img.url} className="h-full w-full object-cover" muted /><span className="absolute inset-0 flex items-center justify-center bg-black/30"><Play className="h-5 w-5 text-white" /></span></>
                      : <img src={img.url} alt="" className="h-full w-full object-cover" />}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Reference material the coordinator attached (once the final work exists) */}
          {finalImages.length > 0 && referenceImages.length > 0 && (
            <Card className="p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                <Palette className="h-3.5 w-3.5 text-violet-500" /> Reference from coordinator
              </p>
              <div className="flex flex-wrap gap-2">
                {referenceImages.map((img) => (
                  isVideo(img)
                    ? <video key={img._id} src={img.url} className="h-20 w-20 rounded-lg object-cover" muted />
                    : <img key={img._id} src={img.url} alt="" onClick={() => setLightbox(img.url)} className="h-20 w-20 cursor-zoom-in rounded-lg object-cover" />
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: activity chat */}
        <ActivityCard r={r} user={user} onOpenImage={setLightbox} />
      </div>

      {/* Lightbox */}
      <Modal open={!!lightbox} onClose={() => setLightbox(null)} size="xl">
        {lightbox && <img src={lightbox} alt="" className="mx-auto max-h-[80vh] object-contain" />}
      </Modal>

      {rejectOpen && <RejectModal id={id} onClose={() => setRejectOpen(false)} onDone={() => { setRejectOpen(false); invalidate(); }} />}
      {resubmitOpen && <ResubmitModal request={r} onClose={() => setResubmitOpen(false)} onDone={() => { setResubmitOpen(false); invalidate(); }} />}
      {submitOpen && <SubmitDesignModal request={r} onClose={() => setSubmitOpen(false)} onDone={() => { setSubmitOpen(false); invalidate(); }} />}
    </div>
  );
}

// ---- Approval lifecycle ----
// POST:   Submitted -> In review -> Approved -> Posted
// DESIGN: Brief -> In design -> In review -> Approved -> Posted / Delivered
function LifecycleCard({ r }) {
  const rejected = r.status === 'REJECTED';
  const resubmitted = r.status === 'RESUBMITTED';
  const reviewStep = {
    label: rejected ? 'Changes requested' : resubmitted ? 'Back in review' : 'In review',
    date: r.resubmittedAt || r.rejectedAt,
    note: rejected ? (r.resubmitCount > 0 ? `${r.resubmitCount} resubmission${r.resubmitCount > 1 ? 's' : ''} so far` : 'Awaiting resubmission') : null,
    amber: rejected,
  };

  if (r.type === 'DESIGN') {
    const finalLabel = r.status === 'POSTED' ? 'Posted' : r.status === 'DELIVERED' ? 'Delivered' : r.deliveryMode === 'PRINT' ? 'Deliver' : 'Post';
    const steps = [
      { label: 'Brief', date: r.createdAt, note: r.designer?.name ? `to ${r.designer.name}` : null },
      { label: 'In design', date: r.submittedAt },
      reviewStep,
      { label: 'Approved', date: r.approvedAt },
      { label: finalLabel, date: r.postedAt || r.deliveredAt, note: r.status === 'DELIVERED' ? `to ${r.createdBy?.name || 'coordinator'}` : (r.status === 'POSTED' && r.assignedTo?.name ? `by ${r.assignedTo.name}` : null) },
    ];
    const stageIdx = ['POSTED', 'DELIVERED'].includes(r.status) ? 4
      : r.status === 'APPROVED' ? 3
      : ['PENDING', 'RESUBMITTED', 'REJECTED'].includes(r.status) ? 2
      : 1; // IN_DESIGN
    return <LifecycleBar steps={steps} stageIdx={stageIdx} cols={5} hint={<DesignHint r={r} />} />;
  }

  const steps = [
    { label: 'Submitted', date: r.createdAt },
    reviewStep,
    { label: 'Approved', date: r.approvedAt },
    { label: 'Posted', date: r.postedAt },
  ];
  const stageIdx = r.status === 'POSTED' ? 3 : r.status === 'APPROVED' ? 2 : 1;
  return (
    <LifecycleBar steps={steps} stageIdx={stageIdx} cols={4}
      hint={r.status === 'APPROVED' ? <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Awaiting posting by {r.createdBy?.name || 'the submitter'}</p> : null} />
  );
}

// Short contextual line under the DESIGN lifecycle bar.
function DesignHint({ r }) {
  if (r.status === 'IN_DESIGN') return <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400"><Palette className="h-4 w-4" /> {r.designer?.name || 'The designer'} is working on this brief</p>;
  if (r.status === 'APPROVED' && !r.assignedTo) return <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400"><UserCheck className="h-4 w-4" /> Approved — {r.deliveryMode === 'PRINT' ? 'deliver it to the coordinator' : 'allocate a handler to post it'}</p>;
  if (r.status === 'APPROVED' && r.assignedTo) return <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400"><Send className="h-4 w-4" /> Allocated to {r.assignedTo?.name} — awaiting posting</p>;
  if (r.status === 'DELIVERED') return <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-400"><PackageCheck className="h-4 w-4" /> Delivered to {r.createdBy?.name || 'the coordinator'}</p>;
  return null;
}

// Presentational stepper shared by both request types.
function LifecycleBar({ steps, stageIdx, cols, hint }) {
  const percent = Math.round(((stageIdx + 1) / steps.length) * 100);
  return (
    <Card className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 dark:text-white">Approval lifecycle</h3>
        <span className="text-sm font-semibold text-brand-600">{percent}% complete</span>
      </div>
      <div className={cn('grid', cols === 5 ? 'grid-cols-5' : 'grid-cols-4')}>
        {steps.map((s, i) => {
          const done = i < stageIdx;
          const current = i === stageIdx;
          return (
            <div key={s.label} className="relative flex flex-col items-center text-center">
              {i < steps.length - 1 && (
                <span className={cn('absolute top-4 left-[calc(50%+1.25rem)] right-[calc(-50%+1.25rem)] h-0.5 rounded-full',
                  i < stageIdx ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700')} />
              )}
              <span className={cn(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition',
                done && 'bg-brand-600 text-white',
                current && (s.amber ? 'bg-amber-500 text-white ring-4 ring-amber-500/20' : 'bg-brand-600 text-white ring-4 ring-brand-500/20'),
                !done && !current && 'border-2 border-slate-200 dark:border-slate-700 text-slate-400 bg-white dark:bg-slate-900'
              )}>
                {done || (current && i === steps.length - 1) ? <Check className="h-4 w-4" /> : s.amber && current ? <MessageSquareWarning className="h-4 w-4" /> : i + 1}
              </span>
              <p className={cn('mt-2 text-xs font-semibold',
                s.amber && current ? 'text-amber-600' : done || current ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400')}>
                {s.label}
              </p>
              {(done || current) && s.date && <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(s.date)}</p>}
              {(done || current) && s.note && <p className={cn('mt-0.5 text-[11px]', s.amber ? 'text-amber-600' : 'text-slate-400')}>{s.note}</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
      {hint}
    </Card>
  );
}

// ---- Design pipeline: hand the approved design to a platform handler ----
function HandlerRow({ h, matched = false, selected, onSelect }) {
  return (
    <button
      type="button" onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition',
        selected ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10' : 'border-slate-200 hover:border-brand-300 dark:border-slate-700'
      )}
    >
      <Avatar src={h.avatar} name={h.name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-800 dark:text-white">{h.name}</span>
        <span className="block truncate text-xs text-slate-400">{h.email}</span>
      </span>
      {matched && (
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
          Declared handler
        </span>
      )}
    </button>
  );
}

function RoutingCard({ r, privileged, isHandler, onChanged }) {
  const orgId = r.organization?._id || r.organization;
  const [mode, setMode] = useState(null); // 'allocate' | null
  const [selected, setSelected] = useState('');

  const { data: handlerData, isLoading } = useQuery({
    queryKey: ['handlers', String(orgId), r.platform],
    queryFn: () => approvalApi.handlers(orgId, r.platform),
    enabled: mode === 'allocate',
  });
  // Both lists are social handlers (see /users/handlers); declared ones (mapped
  // to this platform) get a badge, the rest are still valid allocation targets.
  const declaredIds = new Set((handlerData?.handlers || []).map((h) => String(h._id)));
  const seenHandler = new Set();
  const handlers = [...(handlerData?.handlers || []), ...(handlerData?.fallback || [])]
    .filter((h) => h?._id && !seenHandler.has(String(h._id)) && seenHandler.add(String(h._id)));

  const assignMut = useMutation({
    mutationFn: (userId) => approvalApi.assign(r._id, userId),
    onSuccess: () => { toast.success('Allocated to handler'); setMode(null); setSelected(''); onChanged(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to allocate'),
  });
  const deliverMut = useMutation({
    mutationFn: () => approvalApi.deliver(r._id),
    onSuccess: () => { toast.success('Delivered to coordinator'); onChanged(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to deliver'),
  });

  // Nothing to route before approval — the approve/reject controls are in the header.
  if (['PENDING', 'RESUBMITTED', 'REJECTED'].includes(r.status)) return null;

  if (r.status === 'IN_DESIGN') {
    return (
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-800 dark:text-white"><Palette className="h-4 w-4 text-indigo-500" /> Design in progress</h3>
        <div className="flex items-center gap-3">
          <Avatar src={r.designer?.avatar} name={r.designer?.name} size="md" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{r.designer?.name || 'Designer'}</p>
            <p className="text-xs text-slate-400">is working on this brief for {r.platform}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (r.status === 'DELIVERED') {
    return (
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-800 dark:text-white"><PackageCheck className="h-4 w-4 text-teal-500" /> Delivered</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">Delivered to <span className="font-semibold">{r.createdBy?.name || 'the coordinator'}</span>{r.deliveredAt ? ` on ${formatDate(r.deliveredAt)}` : ''}. The final design can be downloaded above.</p>
      </Card>
    );
  }

  if (r.status === 'POSTED') {
    return (
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-800 dark:text-white"><Send className="h-4 w-4 text-violet-500" /> Posted</h3>
        <div className="flex items-center gap-3">
          <Avatar src={r.assignedTo?.avatar} name={r.assignedTo?.name || r.postedBy?.name} size="md" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{r.assignedTo?.name || r.postedBy?.name || 'Handler'}</p>
            <p className="text-xs text-slate-400">posted on {r.platform}{r.postedAt ? ` · ${formatDate(r.postedAt)}` : ''}</p>
          </div>
        </div>
      </Card>
    );
  }

  // APPROVED — the approver routes it (or others see the current routing state).
  const allocated = !!r.assignedTo;
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white"><Share2 className="h-4 w-4 text-brand-500" /> Route this design</h3>
        {r.deliveryMode === 'PRINT'
          ? <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">Coordinator wants: Print (keep a copy)</span>
          : <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">Coordinator wants: Digital (post to channels)</span>}
      </div>

      {allocated && mode !== 'allocate' && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <Avatar src={r.assignedTo?.avatar} name={r.assignedTo?.name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{r.assignedTo?.name}</p>
            <p className="text-xs text-slate-400">Allocated to post on {r.platform}{isHandler ? ' · that’s you — mark it posted from the top' : ''}</p>
          </div>
        </div>
      )}

      {!privileged ? (
        !allocated && <p className="text-sm text-slate-400">Approved — waiting for the branding team to route it.</p>
      ) : mode === 'allocate' ? (
        <div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Pick the social handler who publishes on <span className="font-semibold">{r.platform}</span> for {r.organization?.name || 'this organization'}.</p>
          {isLoading ? <Skeleton className="h-24" /> : handlers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 dark:border-slate-700">No social handlers are mapped to {r.platform} for this organization yet — ask them to add the pages they handle in My Profile.</p>
          ) : (
            <div className="space-y-2">
              {handlers.map((h) => <HandlerRow key={h._id} h={h} matched={declaredIds.has(String(h._id))} selected={selected === h._id} onSelect={() => setSelected(h._id)} />)}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setMode(null); setSelected(''); }}>Cancel</Button>
            <Button size="sm" disabled={!selected} loading={assignMut.isPending} onClick={() => assignMut.mutate(selected)}><UserCheck className="h-4 w-4" /> Allocate</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setMode('allocate')}
            className={cn('rounded-2xl border-2 p-4 text-left transition', r.deliveryMode !== 'PRINT' ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10' : 'border-slate-200 hover:border-brand-300 dark:border-slate-700')}>
            <Share2 className={cn('h-5 w-5', r.deliveryMode !== 'PRINT' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400')} />
            <p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">{allocated ? 'Re-allocate handler' : 'Allocate to social handler'}</p>
            <p className="mt-0.5 text-xs text-slate-400">A handler posts it on {r.platform}.</p>
          </button>
          <button type="button" disabled={deliverMut.isPending}
            onClick={() => window.confirm('Deliver the final design to the coordinator? This closes the request without posting.') && deliverMut.mutate()}
            className={cn('rounded-2xl border-2 p-4 text-left transition disabled:opacity-60', r.deliveryMode === 'PRINT' ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-500/10' : 'border-slate-200 hover:border-teal-300 dark:border-slate-700')}>
            <Truck className={cn('h-5 w-5', r.deliveryMode === 'PRINT' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400')} />
            <p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">Deliver to coordinator</p>
            <p className="mt-0.5 text-xs text-slate-400">Send the final file back to {r.createdBy?.name || 'the coordinator'}.</p>
          </button>
        </div>
      )}
    </Card>
  );
}

// ---- Post details: definition grid + caption/description/hashtags ----
const Def = ({ label, value }) => (
  <div>
    <p className="text-xs text-slate-400">{label}</p>
    <div className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">{value}</div>
  </div>
);

function PostDetailsCard({ r }) {
  const isDesign = r.type === 'DESIGN';
  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold text-slate-800 dark:text-white">{isDesign ? 'Design details' : 'Post details'}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Def label="Organization" value={r.organization?.name || '—'} />
        <Def label="Platform" value={<Badge>{r.platform}</Badge>} />
        <Def label="Aspect ratio" value={r.aspectRatio || '—'} />
        {isDesign && (
          <Def label="Delivery type" value={r.deliveryMode === 'PRINT'
            ? <span className="inline-flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400"><PackageCheck className="h-3.5 w-3.5" /> Print — deliver a copy</span>
            : <span className="inline-flex items-center gap-1 font-semibold text-brand-600 dark:text-brand-400"><Share2 className="h-3.5 w-3.5" /> Digital — post to channels</span>} />
        )}
        <Def label={isDesign ? 'Raised by (coordinator)' : 'Submitted by'} value={
          <span className="flex items-center gap-2">
            <Avatar src={r.createdBy?.avatar} name={r.createdBy?.name} size="sm" />
            <span>{r.createdBy?.name || '—'}</span>
          </span>
        } />
        {isDesign && r.designer && (
          <Def label="Designer" value={
            <span className="flex items-center gap-2"><Avatar src={r.designer?.avatar} name={r.designer?.name} size="sm" /><span>{r.designer?.name}</span></span>
          } />
        )}
        {isDesign && r.assignedTo && (
          <Def label="Social handler" value={
            <span className="flex items-center gap-2"><Avatar src={r.assignedTo?.avatar} name={r.assignedTo?.name} size="sm" /><span>{r.assignedTo?.name}</span></span>
          } />
        )}
        <Def label={isDesign ? 'Raised on' : 'Submitted on'} value={formatDateTime(r.createdAt)} />
        {isDesign && r.submittedAt && <Def label="Design submitted" value={formatDateTime(r.submittedAt)} />}
        {r.approvedAt && <Def label={`Approved${r.approvedBy?.name ? ` by ${r.approvedBy.name}` : ''}`} value={formatDateTime(r.approvedAt)} />}
        {r.deliveredAt && <Def label={`Delivered${r.deliveredBy?.name ? ` by ${r.deliveredBy.name}` : ''}`} value={formatDateTime(r.deliveredAt)} />}
        {r.postedAt && <Def label="Posted on" value={formatDateTime(r.postedAt)} />}
        {r.resubmitCount > 0 && <Def label="Resubmissions" value={r.resubmitCount} />}
      </div>
      {(r.caption || r.description || r.hashtags?.length > 0) && (
        <div className="mt-5 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
          {r.caption && <Def label="Caption" value={<span className="whitespace-pre-wrap">{r.caption}</span>} />}
          {r.description && <Def label="Description" value={<span className="whitespace-pre-wrap">{r.description}</span>} />}
          {r.hashtags?.length > 0 && (
            <div>
              <p className="text-xs text-slate-400">Hashtags</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {r.hashtags.map((h, i) => <span key={i} className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-600"><Hash className="h-3 w-3" />{h}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---- Activity: chat-style thread of events, feedback and messages ----
const eventIcon = (text = '') => {
  if (text.includes('approved')) return CheckCircle2;
  if (text.includes('changes')) return MessageSquareWarning;
  if (text.includes('resubmitted')) return RefreshCw;
  if (text.includes('posted')) return Send;
  return FilePlus2;
};

function ActivityCard({ r, user, onOpenImage }) {
  const qc = useQueryClient();
  const feedRef = useRef(null);
  const fileRef = useRef(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const isViewer = !!user?.viewOnly;

  // Legacy rows predate `kind` — comments with a category are reviewer feedback.
  const items = [
    { _id: 'created', kind: 'event', author: r.createdBy, text: 'submitted this request', createdAt: r.createdAt },
    ...(r.comments || []).map((c) => ({ ...c, kind: c.kind || (c.category ? 'feedback' : 'message') })),
  ];

  // Keep the newest entry in view whenever the thread grows.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  const addFiles = (list) => {
    const merged = [...files, ...Array.from(list)].slice(0, 6);
    if (files.length + list.length > 6) toast.error('Up to 6 attachments per message');
    setFiles(merged);
  };

  const sendMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('text', text.trim());
      files.forEach((f) => fd.append('files', f));
      return approvalApi.comment(r._id, fd);
    },
    onSuccess: () => { setText(''); setFiles([]); qc.invalidateQueries({ queryKey: ['approval', r._id] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to send'),
  });
  const canSend = text.trim() || files.length > 0;

  return (
    <Card className="sticky top-20 flex max-h-[70vh] flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 dark:text-white">Activity</h3>
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{items.length}</span>
      </div>

      <div ref={feedRef} className="-mx-1 flex-1 space-y-3 overflow-y-auto px-1 pb-1">
        {items.map((c, idx) => {
          const key = c._id || idx;
          if (c.kind === 'event') {
            const Icon = eventIcon(c.text);
            return (
              <div key={key} className="flex items-center justify-center gap-1.5 py-1 text-center text-xs text-slate-400">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span><span className="font-semibold">{c.author?.name || 'Someone'}</span> {c.text}</span>
                <span className="shrink-0">· {timeAgo(c.createdAt)}</span>
              </div>
            );
          }
          const mine = String(c.author?._id) === String(user?._id);
          const atts = c.attachments || [];
          if (c.kind === 'feedback') {
            return (
              <div key={key} className="flex flex-col items-start">
                <MsgMeta c={c} mine={false} />
                <div className="mt-1 max-w-[90%] rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                  <FeedbackCategoryTag category={c.category} />
                  <p className="mt-1 whitespace-pre-wrap break-words">{c.text}</p>
                </div>
              </div>
            );
          }
          return (
            <div key={key} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <MsgMeta c={c} mine={mine} />
              <div className={cn('mt-1 max-w-[90%] rounded-2xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
                mine ? 'border border-brand-500/20 bg-brand-500/10' : 'bg-slate-100 dark:bg-slate-800')}>
                {c.text && <p className="whitespace-pre-wrap break-words">{c.text}</p>}
                {atts.length > 0 && (
                  <div className={cn('grid grid-cols-2 gap-1.5', c.text && 'mt-2')}>
                    {atts.map((a, i) => (
                      isVideo(a)
                        ? <video key={i} src={a.url} controls className="w-full rounded-lg" />
                        : <img key={i} src={a.url} alt={a.name || ''} onClick={() => onOpenImage(a.url)} className="h-20 w-full cursor-pointer rounded-lg object-cover" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer (hidden for the view-only Chairman) */}
      {isViewer ? (
        <p className="mt-3 border-t border-slate-100 pt-3 text-center text-xs text-slate-400 dark:border-slate-800">View-only access — you can’t post messages.</p>
      ) : (
      <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex max-w-[160px] items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs text-slate-600 dark:text-slate-300">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="shrink-0 text-slate-400 hover:text-rose-500"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <textarea rows={2} className="input-base resize-none" placeholder="Write a message…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach images or videos"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
            <Paperclip className="h-4 w-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <Button size="sm" loading={sendMut.isPending} disabled={!canSend} onClick={() => sendMut.mutate()}>
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
        </div>
      </div>
      )}
    </Card>
  );
}

const MsgMeta = ({ c, mine }) => (
  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
    {!mine && <Avatar src={c.author?.avatar} name={c.author?.name} size="sm" className="h-5 w-5 text-[9px]" />}
    <span className="font-semibold text-slate-500 dark:text-slate-400">{mine ? 'You' : c.author?.name || 'Someone'}</span>
    <span>· {timeAgo(c.createdAt)}</span>
  </div>
);

// What a rejection feedback point asks the user to change.
export const FEEDBACK_CATEGORIES = ['Image', 'Content', 'Other', 'Reject'];
export const FEEDBACK_CATEGORY_STYLES = {
  Image: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  Content: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Other: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  Reject: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};
export function FeedbackCategoryTag({ category }) {
  if (!category) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${FEEDBACK_CATEGORY_STYLES[category] || FEEDBACK_CATEGORY_STYLES.Other}`}>
      {category === 'Reject' ? 'Not usable' : category}
    </span>
  );
}

function RejectModal({ id, onClose, onDone }) {
  const [points, setPoints] = useState([{ text: '', category: 'Content' }]);
  const [loading, setLoading] = useState(false);
  const update = (i, patch) => setPoints(points.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const add = () => setPoints([...points, { text: '', category: 'Content' }]);
  const remove = (i) => setPoints(points.filter((_, idx) => idx !== i));

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
            <span className="mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/20 text-xs font-bold text-rose-600">{i + 1}</span>
            <select className="input-base mt-0 h-11 w-32 shrink-0 cursor-pointer py-0" value={p.category} onChange={(e) => update(i, { category: e.target.value })}>
              {FEEDBACK_CATEGORIES.map((c) => <option key={c} value={c}>{c === 'Reject' ? 'Not usable' : c}</option>)}
            </select>
            <Input value={p.text} onChange={(e) => update(i, { text: e.target.value })} placeholder={p.category === 'Image' ? 'What to change in the image…' : p.category === 'Reject' ? 'Why it can’t be used…' : 'What to change…'} />
            {points.length > 1 && <button onClick={() => remove(i)} className="mt-1.5 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-2" onClick={add}><Plus className="h-4 w-4" /> Add another point</Button>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={submit}>Send back</Button>
      </div>
    </Modal>
  );
}

function ResubmitModal({ request, onClose, onDone }) {
  const [form, setForm] = useState({
    title: request.title, caption: request.caption || '', description: request.description || '',
    hashtags: (request.hashtags || []).join(', '),
  });
  // Ordered list of existing images with a kept flag — drag to reorder, click to keep/remove.
  const [ordered, setOrdered] = useState(
    [...(request.images || [])].sort((a, b) => a.order - b.order).map((img) => ({ ...img, kept: true }))
  );
  const [newImages, setNewImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);

  const toggleKeep = (id) => setOrdered((arr) => arr.map((img) => (img._id === id ? { ...img, kept: !img.kept } : img)));
  const onDrop = (target) => {
    if (dragIdx === null || dragIdx === target) return;
    setOrdered((arr) => {
      const next = [...arr];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  const submit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('caption', form.caption);
      fd.append('description', form.description);
      fd.append('hashtags', form.hashtags);
      // Send kept image ids in display order + matching order indices
      const keep = ordered.filter((img) => img.kept);
      keep.forEach((img, i) => { fd.append('keepImageIds', img._id); fd.append('order', i); });
      newImages.forEach((img) => fd.append('images', img));
      await approvalApi.resubmit(request._id, fd);
      toast.success('Resubmitted for review');
      onDone();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Edit & Resubmit" size="lg">
      <div className="space-y-4">
        <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Existing media (click to keep/remove · drag to reorder)</span>
          <div className="flex flex-wrap gap-2">
            {ordered.map((img, i) => (
              <button key={img._id} onClick={() => toggleKeep(img._id)}
                draggable onDragStart={() => setDragIdx(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)}
                className={`relative h-20 w-20 cursor-grab overflow-hidden rounded-lg ring-2 transition active:cursor-grabbing ${img.kept ? 'ring-brand-500' : 'ring-transparent opacity-40'} ${dragIdx === i ? 'opacity-50' : ''}`}>
                {isVideo(img)
                  ? <video src={img.url} className="h-full w-full object-cover" muted />
                  : <img src={img.url} alt="" className="h-full w-full object-cover" />}
                {img.kept
                  ? <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">{ordered.filter((x, idx) => x.kept && idx <= i).length}</span>
                  : <div className="absolute inset-0 flex items-center justify-center bg-rose-500/40"><X className="h-6 w-6 text-white" /></div>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Add new media</span>
          <FileDropzone multiple reorderable accept="image/*,video/*" files={newImages} onChange={setNewImages} label="Drop new images or videos" />
        </div>
        <textarea className="input-base min-h-[70px]" placeholder="Caption" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
        <textarea className="input-base min-h-[70px]" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input label="Hashtags" value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={submit}><RefreshCw className="h-4 w-4" /> Resubmit</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Designer submits the finished work for their assigned brief ----
function SubmitDesignModal({ request, onClose, onDone }) {
  const [form, setForm] = useState({
    caption: request.caption || '', description: request.description || '',
    hashtags: (request.hashtags || []).join(', '), aspectRatio: request.aspectRatio || '1:1',
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (images.length === 0) { toast.error('Upload the finished design first'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('caption', form.caption);
      fd.append('description', form.description);
      fd.append('hashtags', form.hashtags);
      fd.append('aspectRatio', form.aspectRatio);
      images.forEach((img, i) => { fd.append('images', img); fd.append('order', i); });
      await approvalApi.submitDesign(request._id, fd);
      toast.success('Design submitted for approval');
      onDone();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Upload & submit design" size="lg">
      <div className="space-y-4">
        {(request.description || request.caption) && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm dark:border-violet-500/30 dark:bg-violet-500/10">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300"><Palette className="h-3.5 w-3.5" /> Brief from {request.createdBy?.name || 'coordinator'}</p>
            {request.description && <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{request.description}</p>}
          </div>
        )}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Finished design (images / videos)</span>
          <FileDropzone multiple reorderable accept="image/*,video/*" files={images} onChange={setImages} label="Drop the finished design here" />
        </div>
        <textarea className="input-base min-h-[70px]" placeholder="Caption (optional)" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
        <textarea className="input-base min-h-[70px]" placeholder="Notes for the approver (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input label="Hashtags" value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={submit}><Upload className="h-4 w-4" /> Submit for approval</Button>
        </div>
      </div>
    </Modal>
  );
}
