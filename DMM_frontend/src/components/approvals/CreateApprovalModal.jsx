import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { approvalApi, organizationApi } from '../../api/endpoints.js';
import { useAuthStore } from '../../store/authStore.js';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input, Select } from '../ui/primitives.jsx';
import FileDropzone from '../ui/FileDropzone.jsx';

const PLATFORMS = ['LinkedIn', 'Instagram', 'YouTube', 'Facebook'];
// Common social aspect ratios, with a hint of where each is used.
const RATIOS = [
  { value: '1:1', label: '1:1 — Square (feed)' },
  { value: '4:5', label: '4:5 — Portrait (feed)' },
  { value: '9:16', label: '9:16 — Story / Reel / Short' },
  { value: '16:9', label: '16:9 — Landscape (YouTube)' },
  { value: '1.91:1', label: '1.91:1 — Link / landscape' },
];

export default function CreateApprovalModal({ onClose, onSaved }) {
  const { user } = useAuthStore();
  const ownOrgId = user?.organization?._id || user?.organization || '';
  const [form, setForm] = useState({ title: '', platform: 'LinkedIn', caption: '', description: '', hashtags: '', aspectRatio: '1:1', organization: ownOrgId });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Any organization can be the target of an approval request (shared workspace).
  const { data: orgData } = useQuery({ queryKey: ['org-options'], queryFn: organizationApi.options });
  const orgs = orgData?.organizations || [];

  const submit = async (e) => {
    e.preventDefault();
    if (images.length === 0) { toast.error('Please add at least one image or video'); return; }
    if (!form.organization) { toast.error('Please choose the organization this post is for'); return; }
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
      <form onSubmit={submit} className="space-y-4">
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

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Images & videos (drag & drop, multiple, reorderable)</span>
          <FileDropzone multiple reorderable accept="image/*,video/*" files={images} onChange={setImages} label="Drop images or videos here or click to browse" />
        </div>

        <textarea className="input-base min-h-[70px]" placeholder="Caption" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
        <textarea className="input-base min-h-[70px]" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input label="Hashtags (comma or space separated)" value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="college, placement, success" />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Submit Request</Button>
        </div>
      </form>
    </Modal>
  );
}
