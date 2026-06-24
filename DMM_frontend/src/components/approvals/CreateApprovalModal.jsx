import { useState } from 'react';
import toast from 'react-hot-toast';
import { approvalApi } from '../../api/endpoints.js';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input, Select } from '../ui/primitives.jsx';
import FileDropzone from '../ui/FileDropzone.jsx';

const PLATFORMS = ['LinkedIn', 'Instagram', 'YouTube', 'Facebook'];

export default function CreateApprovalModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', platform: 'LinkedIn', caption: '', description: '', hashtags: '' });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (images.length === 0) { toast.error('Please add at least one image'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('platform', form.platform);
      fd.append('caption', form.caption);
      fd.append('description', form.description);
      fd.append('hashtags', form.hashtags);
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Placement Success Story" />
          <Select label="Social Media Platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Images (drag & drop, multiple, reorderable)</span>
          <FileDropzone multiple reorderable accept="image/*" files={images} onChange={setImages} label="Drop images here or click to browse" />
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
