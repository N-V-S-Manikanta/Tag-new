import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, ChevronLeft, ChevronRight, Send, Palette, Sparkles, Loader2 } from 'lucide-react';
import { approvalApi, organizationApi, aiApi } from '../../api/endpoints.js';
import { useAuthStore } from '../../store/authStore.js';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input, Select } from '../ui/primitives.jsx';
import FileDropzone from '../ui/FileDropzone.jsx';
import { cn } from '../../lib/utils.js';

const PLATFORMS = ['LinkedIn', 'Instagram', 'YouTube', 'Facebook'];
// Common social aspect ratios, with a hint of where each is used.
const RATIOS = [
  { value: '1:1', label: '1:1 — Square (feed)' },
  { value: '4:5', label: '4:5 — Portrait (feed)' },
  { value: '9:16', label: '9:16 — Story / Reel / Short' },
  { value: '16:9', label: '16:9 — Landscape (YouTube)' },
  { value: '1.91:1', label: '1.91:1 — Link / landscape' },
];

const STEPS = [
  { n: 1, label: 'Details' },
  { n: 2, label: 'Content' },
  { n: 3, label: 'Media' },
];

// The two pipelines a request can enter.
const TYPE_OPTIONS = [
  { key: 'POST', icon: Send, title: 'Post approval', desc: 'Ready-to-publish content with caption, hashtags & media' },
  { key: 'DESIGN', icon: Palette, title: 'Design approval', desc: 'Creative work — assigned to a platform handler after approval' },
];

export default function CreateApprovalModal({ onClose, onSaved, defaultType = 'POST', sourceDesignId = '' }) {
  const { user } = useAuthStore();
  const ownOrgId = user?.organization?._id || user?.organization || '';
  const [step, setStep] = useState(1);
  // Raising the post for an approved design locks the type to POST.
  const [type, setType] = useState(sourceDesignId ? 'POST' : defaultType);
  const [form, setForm] = useState({ title: '', platform: 'LinkedIn', caption: '', description: '', hashtags: '', aspectRatio: '1:1', organization: ownOrgId });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [tagoNote, setTagoNote] = useState('');

  // Any organization can be the target of an approval request (shared workspace).
  const { data: orgData } = useQuery({ queryKey: ['org-options'], queryFn: organizationApi.options });
  const orgs = orgData?.organizations || [];

  // Only offer AI drafting when the backend has an Anthropic key configured.
  const { data: aiStatus } = useQuery({ queryKey: ['ai-status'], queryFn: aiApi.status, staleTime: 5 * 60 * 1000 });
  const aiReady = !!aiStatus?.configured;

  // One-click on-brand draft: fills caption + hashtags, keeps the user's own
  // description untouched and shows Tago's angle as a note.
  const draftWithTago = async () => {
    if (!form.title.trim() && !form.description.trim() && !form.caption.trim()) {
      toast.error('Add a title or a short brief first so Tago knows the topic'); return;
    }
    setDrafting(true);
    try {
      const r = await aiApi.draft({
        platform: form.platform,
        organization: form.organization,
        title: form.title,
        brief: form.description,
        caption: form.caption,
      });
      setForm((f) => ({
        ...f,
        caption: r.caption || f.caption,
        hashtags: r.hashtags || f.hashtags,
      }));
      setTagoNote(r.description || '');
      toast.success('Tago drafted your post — review and edit as you like');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not draft right now — try again in a moment');
    } finally { setDrafting(false); }
  };

  // When composing from an approved design, prefill org/platform/title from it.
  const { data: designData } = useQuery({
    queryKey: ['approval', sourceDesignId],
    queryFn: () => approvalApi.get(sourceDesignId),
    enabled: !!sourceDesignId,
  });
  const design = designData?.request;
  useEffect(() => {
    if (!design) return;
    setForm((f) => ({
      ...f,
      organization: design.organization?._id || design.organization || f.organization,
      platform: design.platform || f.platform,
      title: f.title || design.title || '',
      aspectRatio: design.aspectRatio || f.aspectRatio,
    }));
  }, [design]);

  const next = () => {
    if (step === 1) {
      if (!form.organization) { toast.error('Please choose the organization this post is for'); return; }
      if (!form.title.trim()) { toast.error('Please give the request a title'); return; }
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const submit = async () => {
    if (images.length === 0) { toast.error('Please add at least one image or video'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('type', type);
      fd.append('platform', form.platform);
      fd.append('organization', form.organization);
      fd.append('caption', form.caption);
      fd.append('description', form.description);
      fd.append('hashtags', form.hashtags);
      fd.append('aspectRatio', form.aspectRatio);
      if (sourceDesignId) fd.append('sourceDesign', sourceDesignId);
      images.forEach((img) => fd.append('images', img));
      await approvalApi.create(fd);
      toast.success(type === 'DESIGN' ? 'Design submitted for approval' : 'Post approval request submitted');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={type === 'DESIGN' ? 'Submit Design for Approval' : 'Create Post Approval Request'} size="lg">
      {/* Composing from an approved design — the pipeline link is automatic */}
      {sourceDesignId && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3.5 dark:border-violet-500/30 dark:bg-violet-500/10">
          <Palette className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Raising the <span className="font-semibold">post request</span> for the approved design{' '}
            <span className="font-semibold text-violet-600 dark:text-violet-300">{design?.title || '…'}</span>.
            Organization and platform are carried over; add the caption, hashtags and final media.
          </p>
        </div>
      )}

      {/* Stepper */}
      <div className="mb-6 flex items-center">
        {STEPS.map((s, i) => {
          const done = step > s.n;
          const current = step === s.n;
          return (
            <div key={s.n} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition',
                  done && 'bg-emerald-500 text-white',
                  current && 'bg-brand-600 text-white',
                  !done && !current && 'border-2 border-slate-200 dark:border-slate-700 text-slate-400'
                )}>
                  {done ? <Check className="h-4 w-4" /> : s.n}
                </span>
                <span className={cn('text-sm font-semibold', current ? 'text-slate-800 dark:text-white' : 'text-slate-400')}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('mx-3 h-0.5 flex-1 rounded-full', done ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1 — Details */}
      {step === 1 && (
        <div className="space-y-4">
          {!sourceDesignId && (
            <div className="grid gap-3 sm:grid-cols-2">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.key} type="button" onClick={() => setType(o.key)}
                  className={cn(
                    'rounded-2xl border-2 p-4 text-left transition',
                    type === o.key ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10' : 'border-slate-200 hover:border-brand-300 dark:border-slate-700'
                  )}
                >
                  <o.icon className={cn('h-5 w-5', type === o.key ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400')} />
                  <p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">{o.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{o.desc}</p>
                </button>
              ))}
            </div>
          )}
          <Select label="Organization (who this post is for)" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })}>
            <option value="">— Select organization —</option>
            {orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Placement Success Story" />
            <Select label="Social Media Platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <Select label="Image / video ratio" value={form.aspectRatio} onChange={(e) => setForm({ ...form, aspectRatio: e.target.value })}>
            {RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
      )}

      {/* Step 2 — Content */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Tago AI drafting — one click turns the brief into a ready caption */}
          {aiReady && (
            <div className="rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50 to-white p-3.5 dark:border-brand-500/25 dark:from-brand-500/10 dark:to-transparent">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-amber-500 text-white shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">Let Tago write it for you</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">On-brand {form.platform} caption &amp; hashtags from your title{form.description.trim() ? ' & brief' : ''}.</p>
                  </div>
                </div>
                <button
                  type="button" onClick={draftWithTago} disabled={drafting}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition',
                    'bg-gradient-to-r from-brand-600 to-amber-500 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70'
                  )}
                >
                  {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {drafting ? 'Tago is writing…' : form.caption.trim() ? 'Redraft with Tago' : 'Draft with Tago'}
                </button>
              </div>
              {tagoNote && (
                <p className="mt-3 flex items-start gap-1.5 border-t border-brand-200/60 pt-2.5 text-xs text-slate-500 dark:border-brand-500/20 dark:text-slate-400">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-brand-500" />
                  <span><span className="font-semibold text-slate-600 dark:text-slate-300">Tago’s note:</span> {tagoNote}</span>
                </p>
              )}
            </div>
          )}
          <textarea className="input-base min-h-[70px]" placeholder="Caption" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
          <textarea className="input-base min-h-[70px]" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Hashtags (comma or space separated)" value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="college, placement, success" />
        </div>
      )}

      {/* Step 3 — Media */}
      {step === 3 && (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Images & videos (drag & drop, multiple, reorderable)</span>
          <FileDropzone multiple reorderable accept="image/*,video/*" files={images} onChange={setImages} label="Drop images or videos here or click to browse" />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}><ChevronLeft className="h-4 w-4" /> Back</Button>
          )}
          {step < 3 ? (
            <Button type="button" onClick={next}>Next <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <Button type="button" loading={loading} onClick={submit}>Submit Request</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
