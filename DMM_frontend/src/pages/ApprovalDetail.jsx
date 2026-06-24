import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Check, X, Send, RefreshCw, Plus, Trash2, MessageSquareWarning,
  CheckCircle2, Clock, Hash,
} from 'lucide-react';
import { approvalApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/authStore.js';
import { Button } from '../components/ui/Button.jsx';
import { Card, Badge, Avatar, Skeleton, Input } from '../components/ui/primitives.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import FileDropzone from '../components/ui/FileDropzone.jsx';
import { formatDateTime, timeAgo } from '../lib/utils.js';

export default function ApprovalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isCEO = user?.role === 'CEO';

  const [activeImg, setActiveImg] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['approval', id], queryFn: () => approvalApi.get(id) });
  const r = data?.request;
  const isOwner = r && (r.createdBy?._id === user?._id);

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

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-40" /><div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-96 lg:col-span-2" /><Skeleton className="h-96" /></div></div>;
  if (!r) return <p className="text-slate-400">Request not found.</p>;

  const images = [...(r.images || [])].sort((a, b) => a.order - b.order);
  const latestReview = r.reviews?.[r.reviews.length - 1];

  return (
    <div>
      <button onClick={() => navigate('/approvals')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        <ArrowLeft className="h-4 w-4" /> Back to approvals
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: gallery + content */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="relative aspect-video cursor-zoom-in bg-slate-100 dark:bg-slate-800" onClick={() => setZoom(true)}>
              {images[activeImg] ? (
                <img src={images[activeImg].url} alt="" className="h-full w-full object-contain" />
              ) : <div className="flex h-full items-center justify-center text-slate-300">No image</div>}
              <Badge status={r.status} className="absolute right-3 top-3">{r.status}</Badge>
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {images.map((img, i) => (
                  <button key={img._id} onClick={() => setActiveImg(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === activeImg ? 'ring-brand-500' : 'ring-transparent opacity-70 hover:opacity-100'}`}>
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Content */}
          <Card className="p-5">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">{r.title}</h2>
            <div className="mt-2 flex items-center gap-2">
              <Badge>{r.platform}</Badge>
              <span className="text-xs text-slate-400">Submitted {formatDateTime(r.createdAt)}</span>
            </div>
            {r.caption && <div className="mt-4"><p className="text-xs font-semibold uppercase text-slate-400">Caption</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{r.caption}</p></div>}
            {r.description && <div className="mt-4"><p className="text-xs font-semibold uppercase text-slate-400">Description</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{r.description}</p></div>}
            {r.hashtags?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Hashtags</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.hashtags.map((h, i) => <span key={i} className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-600"><Hash className="h-3 w-3" />{h}</span>)}
                </div>
              </div>
            )}
          </Card>

          {/* CEO feedback */}
          {latestReview && (
            <Card className="border-rose-200 dark:border-rose-500/30 p-5">
              <div className="mb-3 flex items-center gap-2 text-rose-600">
                <MessageSquareWarning className="h-5 w-5" />
                <h3 className="font-bold">Reviewer Feedback</h3>
              </div>
              <ol className="space-y-2">
                {latestReview.feedbackPoints.map((fp, i) => {
                  const text = typeof fp === 'string' ? fp : fp.text;
                  const category = typeof fp === 'string' ? null : fp.category;
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/20 text-xs font-bold text-rose-600">{i + 1}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <FeedbackCategoryTag category={category} />
                        {text}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-slate-400">Reviewed {timeAgo(latestReview.reviewedAt)}</p>
            </Card>
          )}
        </div>

        {/* Right: meta + actions */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="mb-4 font-bold text-slate-800 dark:text-white">Details</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <Avatar src={r.createdBy?.avatar} name={r.createdBy?.name} />
                <div><p className="font-semibold text-slate-700 dark:text-slate-200">{r.createdBy?.name}</p><p className="text-xs text-slate-400">{r.createdBy?.email}</p></div>
              </div>
              <Row label="Status" value={<Badge status={r.status}>{r.status}</Badge>} />
              <Row label="Platform" value={r.platform} />
              <Row label="Images" value={images.length} />
              {r.approvedAt && <Row label="Approved" value={formatDateTime(r.approvedAt)} />}
              {r.postedAt && <Row label="Posted" value={formatDateTime(r.postedAt)} />}
              {r.resubmitCount > 0 && <Row label="Resubmissions" value={r.resubmitCount} />}
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-5">
            <h3 className="mb-4 font-bold text-slate-800 dark:text-white">Actions</h3>
            <div className="space-y-2">
              {isCEO && (r.status === 'PENDING' || r.status === 'RESUBMITTED') && (
                <>
                  <Button variant="success" className="w-full" loading={approveMut.isPending} onClick={() => approveMut.mutate()}><Check className="h-4 w-4" /> Approve</Button>
                  <Button variant="danger" className="w-full" onClick={() => setRejectOpen(true)}><X className="h-4 w-4" /> Request changes / Reject</Button>
                </>
              )}
              {isOwner && r.status === 'REJECTED' && (
                <Button className="w-full" onClick={() => setResubmitOpen(true)}><RefreshCw className="h-4 w-4" /> Edit & Resubmit</Button>
              )}
              {isOwner && r.status === 'APPROVED' && (
                <Button variant="primary" className="w-full" loading={postedMut.isPending} onClick={() => postedMut.mutate()}><Send className="h-4 w-4" /> Mark as Posted</Button>
              )}
              {r.status === 'POSTED' && (
                <div className="flex items-center gap-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 p-3 text-sm font-medium text-violet-600"><CheckCircle2 className="h-5 w-5" /> Content has been posted</div>
              )}
              {isCEO && r.status === 'APPROVED' && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 text-sm font-medium text-emerald-600"><Clock className="h-5 w-5" /> Awaiting posting by user</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Zoom modal */}
      <Modal open={zoom} onClose={() => setZoom(false)} size="xl">
        {images[activeImg] && <img src={images[activeImg].url} alt="" className="mx-auto max-h-[80vh] object-contain" />}
      </Modal>

      {rejectOpen && <RejectModal id={id} onClose={() => setRejectOpen(false)} onDone={() => { setRejectOpen(false); invalidate(); }} />}
      {resubmitOpen && <ResubmitModal request={r} onClose={() => setResubmitOpen(false)} onDone={() => { setResubmitOpen(false); invalidate(); }} />}
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-400">{label}</span>
    <span className="font-medium text-slate-700 dark:text-slate-200">{value}</span>
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
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Existing images (click to keep/remove · drag to reorder)</span>
          <div className="flex flex-wrap gap-2">
            {ordered.map((img, i) => (
              <button key={img._id} onClick={() => toggleKeep(img._id)}
                draggable onDragStart={() => setDragIdx(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)}
                className={`relative h-20 w-20 cursor-grab overflow-hidden rounded-lg ring-2 transition active:cursor-grabbing ${img.kept ? 'ring-brand-500' : 'ring-transparent opacity-40'} ${dragIdx === i ? 'opacity-50' : ''}`}>
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                {img.kept
                  ? <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">{ordered.filter((x, idx) => x.kept && idx <= i).length}</span>
                  : <div className="absolute inset-0 flex items-center justify-center bg-rose-500/40"><X className="h-6 w-6 text-white" /></div>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Add new images</span>
          <FileDropzone multiple reorderable accept="image/*" files={newImages} onChange={setNewImages} label="Drop new images" />
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
