import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { approvalApi, organizationApi } from '../../api/endpoints.js';
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

export default function CreateApprovalModal({ onClose, onSaved }) {
  const { user } = useAuthStore();
  const ownOrgId = user?.organization?._id || user?.organization || '';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', platform: 'LinkedIn', caption: '', description: '', hashtags: '', aspectRatio: '1:1', organization: ownOrgId });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Any organization can be the target of an approval request (shared workspace).
  const { data: orgData } = useQuery({ queryKey: ['org-options'], queryFn: organizationApi.options });
  const orgs = orgData?.organizations || [];

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
      fd.append('platform', form.platform);
      fd.append('organization', form.organization);
      fd.append('caption', form.caption);
      fd.append('description', form.description);
      fd.append('hashtags', form.hashtags);
      fd.append('aspectRatio', form.aspectRatio);
      images.forEach((img) => fd.append('images', img));
      await approvalApi.create(fd);
      toast.success('Approval request submitted');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Create Approval Request" size="lg">
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
