import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Images, Plus, Trash2, ExternalLink, Download, Film, FileText, LinkIcon, Play, Globe } from 'lucide-react';
import { brandApi, linkApi } from '../api/endpoints.js';
import { youtubeThumb, cn } from '../lib/utils.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import OrgPicker from '../components/OrgPicker.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, Input, Select, Skeleton, EmptyState } from '../components/ui/primitives.jsx';
import { Modal } from '../components/ui/Modal.jsx';

const CATEGORIES = ['Flyer', 'Brochure', 'Branding Video', 'Image', 'Document', 'Other'];
const fileUrl = (u) => (u?.startsWith('/uploads') ? `http://localhost:5000${u}` : u);

export default function BrandLibrary() {
  return (
    <div>
      <PageHeader title="Brand Library" subtitle="Flyers, brochures, branding videos and marketing material per organization — upload files or link a YouTube video." />
      <OrgPicker>{(orgId) => <Inner orgId={orgId} />}</OrgPicker>
    </div>
  );
}

function Inner({ orgId }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState('All');
  const key = ['brand', orgId, category];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => brandApi.list({ category }) });
  const items = data?.items || [];
  const [showAdd, setShowAdd] = useState(false);

  const removeMut = useMutation({
    mutationFn: (id) => brandApi.remove(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['brand', orgId] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="max-w-[200px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add item</Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Images} title="Nothing here yet" description="Upload flyers, brochures or branding videos — or paste a YouTube link."
          action={<Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add item</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => <BrandCard key={it._id} item={it} onDelete={() => window.confirm(`Delete "${it.title}"?`) && removeMut.mutate(it._id)} />)}
        </div>
      )}

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['brand', orgId] }); }} />}
    </div>
  );
}

// Type → colour + icon for the placeholder shown when there's no real preview.
const TYPE_META = {
  Video: { tone: 'from-red-500/20 to-rose-500/5 text-red-500', icon: Film },
  PDF: { tone: 'from-rose-500/20 to-orange-500/5 text-rose-500', icon: FileText },
  Document: { tone: 'from-indigo-500/20 to-blue-500/5 text-indigo-500', icon: FileText },
  Link: { tone: 'from-brand-500/20 to-amber-500/5 text-brand-500', icon: Globe },
  Image: { tone: 'from-emerald-500/20 to-teal-500/5 text-emerald-500', icon: Images },
};
const itemType = (item) => {
  if (item.mediaType === 'image') return 'Image';
  if (item.mediaType === 'video') return 'Video';
  if (item.kind === 'link') return 'Link';
  return (item.url || '').toLowerCase().endsWith('.pdf') ? 'PDF' : 'Document';
};

function Placeholder({ type, label }) {
  const meta = TYPE_META[type] || TYPE_META.Document;
  const Icon = meta.icon;
  return (
    <div className={cn('flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br px-4 text-center', meta.tone)}>
      <Icon className="h-10 w-10" />
      {label && <span className="max-w-full truncate text-xs font-semibold opacity-80">{label}</span>}
    </div>
  );
}

// External (non-YouTube) link: pull the Open-Graph preview image if there is one.
function LinkThumb({ url }) {
  const { data, isLoading } = useQuery({ queryKey: ['link-preview', url], queryFn: () => linkApi.preview(url), staleTime: Infinity, retry: false });
  if (data?.image) {
    return (
      <>
        <img src={data.image} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white"><ExternalLink className="h-3 w-3" />{data.siteName}</span>
      </>
    );
  }
  return <Placeholder type="Link" label={isLoading ? 'Loading preview…' : (data?.siteName || 'External link')} />;
}

function BrandCard({ item, onDelete }) {
  const url = fileUrl(item.url);
  const ytThumb = item.kind === 'link' ? youtubeThumb(item.url) : null;
  const isLink = item.kind === 'link';
  const type = ytThumb ? 'Video' : itemType(item);
  return (
    <Card className="group overflow-hidden">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800">
        {item.mediaType === 'image' ? (
          <img src={url} alt={item.title} className="h-full w-full object-cover" />
        ) : ytThumb ? (
          <a href={url} target="_blank" rel="noreferrer" className="group/thumb block h-full w-full">
            <img src={ytThumb} alt={item.title} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover/thumb:bg-black/25">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg"><Play className="h-6 w-6 translate-x-0.5 fill-white" /></span>
            </span>
          </a>
        ) : item.mediaType === 'video' ? (
          <video src={url} className="h-full w-full object-cover" muted />
        ) : isLink ? (
          <LinkThumb url={item.url} />
        ) : (
          <Placeholder type={type} label={type} />
        )}
        <span className="absolute left-2 top-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">{item.category}</span>
        <span className="absolute right-2 top-2 rounded-md bg-white/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 backdrop-blur-sm dark:bg-slate-900/80 dark:text-slate-300">{type}</span>
      </div>
      <div className="p-4">
        <p className="truncate font-semibold text-slate-800 dark:text-white">{item.title}</p>
        {item.description && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.description}</p>}
        <div className="mt-3 flex items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
            {isLink ? <><ExternalLink className="h-3.5 w-3.5" /> Open link</> : <><Download className="h-3.5 w-3.5" /> View / download</>}
          </a>
          <button onClick={onDelete} className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </Card>
  );
}

function AddModal({ onClose, onSaved }) {
  const [mode, setMode] = useState('file'); // file | link
  const [form, setForm] = useState({ title: '', category: 'Flyer', description: '', link: '' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (mode === 'file' && !file) { toast.error('Choose a file to upload'); return; }
    if (mode === 'link' && !form.link.trim()) { toast.error('Paste a link'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('category', form.category);
      fd.append('description', form.description);
      if (mode === 'file') fd.append('file', file);
      else fd.append('link', form.link);
      await brandApi.create(fd);
      toast.success('Added'); onSaved();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title="Add to Brand Library">
      <form onSubmit={submit} className="space-y-4">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" onClick={() => setMode('file')} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === 'file' ? 'bg-white text-brand-700 shadow-soft dark:bg-slate-900 dark:text-brand-300' : 'text-slate-500'}`}>Upload file</button>
          <button type="button" onClick={() => setMode('link')} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === 'link' ? 'bg-white text-brand-700 shadow-soft dark:bg-slate-900 dark:text-brand-300' : 'text-slate-500'}`}>YouTube / link</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Admissions Flyer 2026" />
          <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        {mode === 'file' ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">File (image, video or PDF)</span>
            <input type="file" accept="image/*,video/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 dark:file:bg-brand-500/10 dark:file:text-brand-300" />
          </label>
        ) : (
          <Input label="YouTube / external link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://youtube.com/watch?v=…" />
        )}
        <textarea className="input-base min-h-[60px]" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={loading}>Add</Button></div>
      </form>
    </Modal>
  );
}
