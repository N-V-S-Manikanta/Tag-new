import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Plus, Search, Download, Trash2, Pencil, FileImage, Eye, FolderOpen,
} from 'lucide-react';
import { motion } from 'framer-motion';
import PageHeader from './layout/PageHeader.jsx';
import { Button } from './ui/Button.jsx';
import { Card, Input, Select, Badge, Avatar, Skeleton, EmptyState } from './ui/primitives.jsx';
import { Modal } from './ui/Modal.jsx';
import FileDropzone from './ui/FileDropzone.jsx';
import { formatDate, formatBytes } from '../lib/utils.js';
import { useAuthStore } from '../store/authStore.js';

/**
 * Generic repository page for Templates and Assets (near-identical CRUD UIs).
 * `cfg` supplies the API, labels, categories and field names that differ.
 */
export default function RepositoryPage({ cfg }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [preview, setPreview] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: [cfg.key, { search, category }],
    queryFn: () => cfg.api.list({ search, category, limit: 48 }),
  });
  const items = data?.[cfg.listField] || [];

  const removeMut = useMutation({
    mutationFn: (id) => cfg.api.remove(id),
    onSuccess: () => { toast.success(`${cfg.singular} deleted`); qc.invalidateQueries({ queryKey: [cfg.key] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const handleDownload = async (item) => {
    try {
      await cfg.api.download(item._id);
      window.open(item.fileUrl, '_blank');
      qc.invalidateQueries({ queryKey: [cfg.key] });
    } catch { toast.error('Download failed'); }
  };

  const canManage = (item) => user?.role === 'CEO' || item.uploadedBy?._id === user?._id || item.uploadedBy === user?._id;

  return (
    <div>
      <PageHeader
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={<Button onClick={() => { setEditItem(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Upload {cfg.singular}</Button>}
      />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder={`Search ${cfg.plural.toLowerCase()}...`} className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="sm:w-56" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {cfg.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={FolderOpen} title={`No ${cfg.plural.toLowerCase()} found`}
          description="Try adjusting filters or upload a new one."
          action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Upload {cfg.singular}</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, i) => {
            const thumb = item[cfg.thumbField];
            return (
              <motion.div key={item._id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card className="group overflow-hidden">
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {thumb ? (
                      <img src={thumb} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><FileImage className="h-10 w-10 text-slate-300" /></div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/40 opacity-0 transition group-hover:opacity-100">
                      <button onClick={() => setPreview(item)} className="rounded-lg bg-white/90 p-2 text-slate-700 hover:bg-white" title="Preview"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => handleDownload(item)} className="rounded-lg bg-white/90 p-2 text-slate-700 hover:bg-white" title="Download"><Download className="h-4 w-4" /></button>
                    </div>
                    <Badge className="absolute left-2 top-2 bg-white/90 dark:bg-slate-900/90">{item.fileType}</Badge>
                  </div>
                  <div className="p-4">
                    <p className="truncate font-semibold text-slate-800 dark:text-white">{item.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{item.category}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar src={item.uploadedBy?.avatar} name={item.uploadedBy?.name} size="sm" />
                        <span className="text-xs text-slate-400">{formatDate(item.createdAt)}</span>
                      </div>
                      {canManage(item) && (
                        <div className="flex gap-1">
                          <button onClick={() => { setEditItem(item); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => window.confirm(`Delete "${item.name}"?`) && removeMut.mutate(item._id)} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <UploadModal cfg={cfg} editItem={editItem} onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); qc.invalidateQueries({ queryKey: [cfg.key] }); }} />
      )}

      {/* Preview modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name} size="lg">
        {preview && (
          <div>
            <div className="overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
              {preview[cfg.thumbField] ? (
                <img src={preview[cfg.thumbField]} alt={preview.name} className="max-h-[60vh] w-full object-contain" />
              ) : (
                <div className="flex h-64 items-center justify-center"><FileImage className="h-16 w-16 text-slate-300" /></div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-400">Category</p><p className="font-medium">{preview.category}</p></div>
              <div><p className="text-slate-400">Type</p><p className="font-medium">{preview.fileType}</p></div>
              <div><p className="text-slate-400">Size</p><p className="font-medium">{formatBytes(preview.fileSize)}</p></div>
              <div><p className="text-slate-400">Downloads</p><p className="font-medium">{preview.downloads}</p></div>
            </div>
            {preview.description && <p className="mt-4 text-sm text-slate-500">{preview.description}</p>}
            <Button className="mt-5 w-full" onClick={() => handleDownload(preview)}><Download className="h-4 w-4" /> Download</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function UploadModal({ cfg, editItem, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: editItem?.name || '', description: editItem?.description || '',
    category: editItem?.category || cfg.categories[0],
  });
  const [file, setFile] = useState([]);
  const [thumb, setThumb] = useState([]);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!editItem && file.length === 0) { toast.error('Please select a file'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('category', form.category);
      if (file[0]) fd.append('file', file[0]);
      if (thumb[0]) fd.append(cfg.thumbFieldName, thumb[0]);
      if (editItem) await cfg.api.update(editItem._id, fd);
      else await cfg.api.create(fd);
      toast.success(`${cfg.singular} ${editItem ? 'updated' : 'uploaded'}`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={`${editItem ? 'Edit' : 'Upload'} ${cfg.singular}`}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`${cfg.singular} name`} />
        <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {cfg.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">File {editItem && '(leave empty to keep current)'}</span>
          <FileDropzone accept={cfg.accept} files={file} onChange={setFile} label="Drop file or click to browse" />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{cfg.thumbLabel} (optional)</span>
          <FileDropzone accept="image/*" files={thumb} onChange={setThumb} label="Add a preview image" />
        </div>
        <textarea className="input-base min-h-[80px]" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{editItem ? 'Save changes' : 'Upload'}</Button>
        </div>
      </form>
    </Modal>
  );
}
