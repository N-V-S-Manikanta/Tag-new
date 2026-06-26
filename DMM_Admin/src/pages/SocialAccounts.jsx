import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Share2, Plus, Pencil, Trash2, Mail, Phone, Star, Users, ExternalLink, X, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { socialAccountApi, organizationApi } from '../api/endpoints.js';
import { downloadBlob } from '../lib/utils.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, Input, Select, Skeleton, EmptyState } from '../components/ui/primitives.jsx';
import { Modal } from '../components/ui/Modal.jsx';

const PLATFORMS = ['LinkedIn', 'Instagram', 'YouTube', 'Facebook', 'X (Twitter)'];
const blankHandler = { name: '', email: '', phone: '', role: '' };
const blank = { platform: 'LinkedIn', organization: '', accountName: '', profileUrl: '', ownerName: '', ownerEmail: '', linkedEmails: '', rating: 0, accessCount: 0, notes: '', handlers: [{ ...blankHandler }] };

export default function SocialAccounts() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ organizationId: 'all', platform: 'All', search: '' });
  const [modal, setModal] = useState(null);
  const fileRef = useRef(null);

  const { data: orgData } = useQuery({ queryKey: ['organizations', 'picker'], queryFn: () => organizationApi.list() });
  const orgs = orgData?.organizations || [];

  const params = { platform: filters.platform, search: filters.search };
  if (filters.organizationId === 'all') params.scope = 'all'; else params.organizationId = filters.organizationId;
  const { data, isLoading } = useQuery({ queryKey: ['social-accounts', filters], queryFn: () => socialAccountApi.list(params) });
  const accounts = data?.accounts || [];

  const removeMut = useMutation({
    mutationFn: (id) => socialAccountApi.remove(id),
    onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({ queryKey: ['social-accounts'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const importMut = useMutation({
    mutationFn: (file) => { const fd = new FormData(); fd.append('file', file); return socialAccountApi.import(fd); },
    onSuccess: (res) => {
      const orgNote = res.organizationsCreated ? `, ${res.organizationsCreated} new organizations` : '';
      toast.success(`Imported ${res.imported} accounts — ${res.created} new, ${res.updated} updated${orgNote}`);
      qc.invalidateQueries({ queryKey: ['social-accounts'] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Import failed'),
  });

  const onPickFile = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importMut.mutate(f); };
  const downloadTemplate = async () => {
    try { downloadBlob(await socialAccountApi.template(), 'social-accounts-template.xlsx'); }
    catch { toast.error('Could not download template'); }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onPickFile} />
      <PageHeader title="Social Media Handlers" subtitle="Who handles each platform per organization — owners, linked emails, coordinators and their contact details."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4" /> Template</Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} loading={importMut.isPending}><Upload className="h-4 w-4" /> Import Excel</Button>
            <Button onClick={() => setModal({ type: 'create' })}><Plus className="h-4 w-4" /> Add account</Button>
          </div>
        } />

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
        <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
        <span>
          <span className="font-semibold text-slate-600 dark:text-slate-300">Excel import:</span> upload your sheet with
          columns like <em>College</em>, <em>Platform</em>, <em>Admin Name</em>, <em>Admin Type</em> and <em>Note</em>.
          The link behind each platform becomes the profile URL, admins become handlers, and a row with a blank platform
          adds more admins to the row above. Each college is matched to an organization (created if new). Re-importing updates
          existing accounts instead of duplicating.
        </span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Select value={filters.organizationId} onChange={(e) => setFilters({ ...filters, organizationId: e.target.value })}>
          <option value="all">All organizations</option>
          {orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
        </Select>
        <Select value={filters.platform} onChange={(e) => setFilters({ ...filters, platform: e.target.value })}>
          <option value="All">All platforms</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Input placeholder="Search account, owner or handler…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Share2} title="No accounts yet" description="Add a social media account and its handlers."
          action={<Button onClick={() => setModal({ type: 'create' })}><Plus className="h-4 w-4" /> Add account</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {accounts.map((a) => (
            <Card key={a._id} className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-white">{a.platform}</span>
                    {a.accountName && <span className="text-sm text-slate-500">· {a.accountName}</span>}
                  </div>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="h-2 w-2 rounded-full" style={{ background: a.organization?.color || '#7c3aed' }} />
                    {a.organization?.name || '—'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal({ type: 'edit', item: a })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => window.confirm('Remove this account?') && removeMut.mutate(a._id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {a.ownerName && <Info label="Owner" value={a.ownerName} />}
                {a.ownerEmail && <Info label="Owner email" value={a.ownerEmail} />}
                <Info label="Rating" value={<span className="inline-flex items-center gap-1">{a.rating || 0}<Star className="h-3.5 w-3.5 text-amber-500" /></span>} />
                <Info label="People with access" value={<span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{a.accessCount || 0}</span>} />
              </div>

              {a.profileUrl && (
                <a href={a.profileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"><ExternalLink className="h-3.5 w-3.5" /> {a.profileUrl}</a>
              )}
              {a.linkedEmails?.length > 0 && (
                <p className="mt-2 text-xs text-slate-400">Linked emails: <span className="text-slate-600 dark:text-slate-300">{a.linkedEmails.join(', ')}</span></p>
              )}

              {a.handlers?.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Handlers</p>
                  <div className="space-y-1.5">
                    {a.handlers.map((h, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{h.name}{h.role ? ` · ${h.role}` : ''}</span>
                        {h.email && <a href={`mailto:${h.email}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600"><Mail className="h-3 w-3" />{h.email}</a>}
                        {h.phone && <a href={`tel:${h.phone}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600"><Phone className="h-3 w-3" />{h.phone}</a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {modal && <AccountModal item={modal.item} orgs={orgs} onClose={() => setModal(null)} onSaved={() => { setModal(null); qc.invalidateQueries({ queryKey: ['social-accounts'] }); }} />}
    </div>
  );
}

const Info = ({ label, value }) => (
  <div><p className="text-xs text-slate-400">{label}</p><p className="font-medium text-slate-700 dark:text-slate-200">{value}</p></div>
);

function AccountModal({ item, orgs, onClose, onSaved }) {
  const [form, setForm] = useState(item
    ? { ...blank, ...item, organization: item.organization?._id || item.organization || '', linkedEmails: (item.linkedEmails || []).join(', '), handlers: item.handlers?.length ? item.handlers.map((h) => ({ ...blankHandler, ...h })) : [{ ...blankHandler }] }
    : blank);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });
  const setHandler = (i, k, v) => setForm({ ...form, handlers: form.handlers.map((h, idx) => (idx === i ? { ...h, [k]: v } : h)) });

  const submit = async (e) => {
    e.preventDefault();
    if (!item && !form.organization) { toast.error('Choose an organization'); return; }
    setLoading(true);
    try {
      const payload = { ...form, handlers: form.handlers.filter((h) => h.name || h.email || h.phone) };
      if (item) await socialAccountApi.update(item._id, payload);
      else await socialAccountApi.create(payload);
      toast.success('Saved'); onSaved();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={item ? 'Edit account' : 'Add social media account'} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {!item && (
            <Select label="Organization" value={form.organization} onChange={(e) => set('organization', e.target.value)}>
              <option value="">Select…</option>
              {orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
            </Select>
          )}
          <Select label="Platform" value={form.platform} onChange={(e) => set('platform', e.target.value)}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Input label="Account / handle" value={form.accountName} onChange={(e) => set('accountName', e.target.value)} placeholder="@college" />
          <Input label="Profile / website URL" value={form.profileUrl} onChange={(e) => set('profileUrl', e.target.value)} placeholder="https://…" />
          <Input label="Owner name" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
          <Input label="Owner email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} />
          <Input label="Rating (0–5)" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => set('rating', e.target.value)} />
          <Input label="People with access" type="number" min="0" value={form.accessCount} onChange={(e) => set('accessCount', e.target.value)} />
        </div>
        <Input label="Linked emails (comma separated)" value={form.linkedEmails} onChange={(e) => set('linkedEmails', e.target.value)} placeholder="a@x.com, b@x.com" />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Handlers (coordinators + contact)</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => set('handlers', [...form.handlers, { ...blankHandler }])}><Plus className="h-4 w-4" /> Add handler</Button>
          </div>
          <div className="space-y-2">
            {form.handlers.map((h, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <Input className="sm:col-span-3" placeholder="Name" value={h.name} onChange={(e) => setHandler(i, 'name', e.target.value)} />
                <Input className="sm:col-span-3" placeholder="Email" value={h.email} onChange={(e) => setHandler(i, 'email', e.target.value)} />
                <Input className="sm:col-span-3" placeholder="Phone" value={h.phone} onChange={(e) => setHandler(i, 'phone', e.target.value)} />
                <Input className="sm:col-span-2" placeholder="Role" value={h.role} onChange={(e) => setHandler(i, 'role', e.target.value)} />
                <button type="button" onClick={() => set('handlers', form.handlers.filter((_, idx) => idx !== i))} className="flex items-center justify-center rounded-lg py-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 sm:col-span-1"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <textarea className="input-base min-h-[60px]" placeholder="Notes (optional)" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={loading}>Save</Button></div>
      </form>
    </Modal>
  );
}
