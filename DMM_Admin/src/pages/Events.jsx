import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Camera, Plus, ExternalLink, MapPin, CalendarDays, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { eventApi, organizationApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/authStore.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select, Card, Skeleton, EmptyState } from '../components/ui/primitives.jsx';
import { formatDate } from '../lib/utils.js';

export default function Events() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ['events', search], queryFn: () => eventApi.list({ search }) });
  const events = data?.events || [];

  const removeMut = useMutation({
    mutationFn: (id) => eventApi.remove(id),
    onSuccess: () => { toast.success('Event deleted'); qc.invalidateQueries({ queryKey: ['events'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const canManage = (ev) => ev.createdBy?._id === user?._id || user?.role === 'ADMIN' || user?.role === 'CEO';

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Event photos captured by the Zolo team. Each event links to its photo folder — open it to view or upload."
        actions={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add Event</Button>}
      />

      <div className="mb-5 max-w-xs">
        <Input placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : events.length === 0 ? (
        <EmptyState icon={Camera} title="No events yet" description="Add an event with its photo-folder link so the team can view and upload pictures." action={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add Event</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <Card key={ev._id} className="group overflow-hidden">
              <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-brand-500/10 to-slate-100 dark:from-brand-500/10 dark:to-slate-800">
                {ev.coverImage ? (
                  <img src={ev.coverImage} alt={ev.name} className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-10 w-10 text-brand-400" />
                )}
                {ev.organization?.name && (
                  <span className="absolute left-2 top-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white">{ev.organization.name}</span>
                )}
                {canManage(ev) && (
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => setEditing(ev)} aria-label="Edit event" className="rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-sm hover:bg-white dark:bg-slate-900/90 dark:text-slate-300"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { if (window.confirm(`Delete "${ev.name}"?`)) removeMut.mutate(ev._id); }} aria-label="Delete event" className="rounded-lg bg-white/90 p-1.5 text-rose-600 shadow-sm hover:bg-white dark:bg-slate-900/90"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="truncate font-bold text-slate-800 dark:text-white">{ev.name}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                  {ev.eventDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(ev.eventDate)}</span>}
                  {ev.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {ev.location}</span>}
                </div>
                {ev.description && <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{ev.description}</p>}
                <a href={ev.folderLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700">
                  <FolderOpen className="h-4 w-4" /> Open photo folder <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <EventModal event={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['events'] }); }} />}
    </div>
  );
}

function EventModal({ event, onClose, onSaved }) {
  const isEdit = !!event._id;
  const [form, setForm] = useState({
    name: event.name || '',
    folderLink: event.folderLink || '',
    eventDate: event.eventDate ? String(event.eventDate).slice(0, 10) : '',
    location: event.location || '',
    description: event.description || '',
    organization: event.organization?._id || '',
  });
  const [cover, setCover] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: orgData } = useQuery({ queryKey: ['orgs-list'], queryFn: () => organizationApi.list() });
  const orgs = orgData?.organizations || [];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Event name is required'); return; }
    if (!/^https?:\/\/\S+/i.test(form.folderLink.trim())) { toast.error('Enter a valid folder link (https://…)'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('folderLink', form.folderLink);
      fd.append('eventDate', form.eventDate);
      fd.append('location', form.location);
      fd.append('description', form.description);
      fd.append('organization', form.organization);
      if (cover) fd.append('cover', cover);
      if (isEdit) await eventApi.update(event._id, fd);
      else await eventApi.create(fd);
      toast.success(isEdit ? 'Event updated' : 'Event added');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Event' : 'Add Event'} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Event name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Annual Tech Fest 2026" />

        <Input label="Photo folder link (OneDrive / Drive / any share URL)" required value={form.folderLink} onChange={(e) => setForm({ ...form, folderLink: e.target.value })} placeholder="https://1drv.ms/f/…" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Event date" type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
          <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Main Auditorium" />
        </div>

        <Select label="Related organization (optional)" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })}>
          <option value="">— None / college-wide —</option>
          {orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
        </Select>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Cover image (optional)</span>
          <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-500/10 dark:file:text-brand-300" />
        </label>

        <textarea className="input-base min-h-[80px]" placeholder="Details about the event…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Save changes' : 'Add Event'}</Button>
        </div>
      </form>
    </Modal>
  );
}
