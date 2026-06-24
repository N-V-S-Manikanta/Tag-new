import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  UserPlus, Search, Pencil, KeyRound, Trash2, Users as UsersIcon, ShieldCheck, Crown, User as UserIcon, MoreVertical, Power,
} from 'lucide-react';
import { userApi, organizationApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/authStore.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, Input, Select, Badge, Avatar, Skeleton, EmptyState } from '../components/ui/primitives.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { formatDate, ROLE_STYLES } from '../lib/utils.js';

const ROLES = ['ADMIN', 'CEO', 'USER'];
const ROLE_ICON = { ADMIN: ShieldCheck, CEO: Crown, USER: UserIcon };

export default function Users() {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const [filters, setFilters] = useState({ search: '', role: 'All', organization: 'All' });
  const [modal, setModal] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ['users', filters], queryFn: () => userApi.list(filters) });
  const users = data?.users || [];
  const { data: orgData } = useQuery({ queryKey: ['organizations', 'all'], queryFn: () => organizationApi.list() });
  const orgs = orgData?.organizations || [];
  const counts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});

  const removeMut = useMutation({
    mutationFn: (id) => userApi.remove(id),
    onSuccess: () => { toast.success('User deleted'); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }) => userApi.update(id, { isActive }),
    onSuccess: () => { toast.success('User updated'); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  });

  const stats = [
    { label: 'Total Users', value: users.length, icon: UsersIcon, cls: 'text-brand-600 bg-brand-50 dark:bg-brand-500/10' },
    { label: 'Admins', value: counts.ADMIN || 0, icon: ShieldCheck, cls: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
    { label: 'CEOs', value: counts.CEO || 0, icon: Crown, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Users', value: counts.USER || 0, icon: UserIcon, cls: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10' },
  ];

  return (
    <div>
      <PageHeader title="User Management" subtitle="Create and manage accounts, roles and access."
        actions={<Button onClick={() => setModal({ type: 'create' })}><UserPlus className="h-4 w-4" /> Add User</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-3 p-4">
            <div className={`rounded-xl p-2.5 ${s.cls}`}><s.icon className="h-5 w-5" /></div>
            <div><p className="text-2xl font-extrabold text-slate-800 dark:text-white">{s.value}</p><p className="text-xs text-slate-400">{s.label}</p></div>
          </Card>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by name or email..." className="pl-9" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <Select className="sm:w-44" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
          <option value="All">All Roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select className="sm:w-52" value={filters.organization} onChange={(e) => setFilters({ ...filters, organization: e.target.value })}>
          <option value="All">All Organizations</option>
          {orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users found" description="Add a user to get started."
          action={<Button onClick={() => setModal({ type: 'create' })}><UserPlus className="h-4 w-4" /> Add User</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Organization</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {users.map((u) => {
                  const RoleIcon = ROLE_ICON[u.role] || UserIcon;
                  const isSelf = u._id === me?._id;
                  return (
                    <tr key={u._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={u.avatar} name={u.name} size="sm" />
                          <div>
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{u.name} {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}</p>
                            <p className="text-xs text-slate-400">{u.email}{u.jobTitle ? ` · ${u.jobTitle}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[u.role]}`}><RoleIcon className="h-3 w-3" />{u.role}</span>
                      </td>
                      <td className="px-5 py-3">
                        {u.organization ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <span className="h-2 w-2 rounded-full" style={{ background: u.organization.color || '#6366f1' }} />
                            {u.organization.name}
                          </span>
                        ) : <span className="text-xs text-slate-400">— Global —</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Badge className={u.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(u.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="relative flex justify-end">
                          <button onClick={() => setMenuFor(menuFor === u._id ? null : u._id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><MoreVertical className="h-4 w-4" /></button>
                          {menuFor === u._id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                              <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-card">
                                <MenuItem icon={Pencil} label="Edit" onClick={() => { setMenuFor(null); setModal({ type: 'edit', user: u }); }} />
                                <MenuItem icon={KeyRound} label="Reset password" onClick={() => { setMenuFor(null); setModal({ type: 'reset', user: u }); }} />
                                <MenuItem icon={Power} label={u.isActive ? 'Deactivate' : 'Activate'} onClick={() => { setMenuFor(null); toggleMut.mutate({ id: u._id, isActive: !u.isActive }); }} />
                                {!isSelf && <MenuItem icon={Trash2} label="Delete" danger onClick={() => { setMenuFor(null); window.confirm(`Delete ${u.name}?`) && removeMut.mutate(u._id); }} />}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal?.type === 'create' && <UserFormModal onClose={() => setModal(null)} onSaved={() => { setModal(null); qc.invalidateQueries({ queryKey: ['users'] }); }} />}
      {modal?.type === 'edit' && <UserFormModal editUser={modal.user} onClose={() => setModal(null)} onSaved={() => { setModal(null); qc.invalidateQueries({ queryKey: ['users'] }); }} />}
      {modal?.type === 'reset' && <ResetPasswordModal user={modal.user} onClose={() => setModal(null)} />}
    </div>
  );
}

const MenuItem = ({ icon: Icon, label, onClick, danger }) => (
  <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${danger ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
    <Icon className="h-4 w-4" /> {label}
  </button>
);

function UserFormModal({ editUser, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: editUser?.name || '', email: editUser?.email || '', password: '',
    role: editUser?.role || 'USER', jobTitle: editUser?.jobTitle || '',
    organization: editUser?.organization?._id || editUser?.organization || '',
  });
  const [loading, setLoading] = useState(false);
  const { data: orgData } = useQuery({ queryKey: ['organizations', 'all'], queryFn: () => organizationApi.list() });
  const orgs = orgData?.organizations || [];
  const needsOrg = form.role === 'CEO' || form.role === 'USER';

  const submit = async (e) => {
    e.preventDefault();
    if (needsOrg && !form.organization) { toast.error('Select an organization for this user'); return; }
    setLoading(true);
    try {
      const payload = {
        name: form.name, role: form.role, jobTitle: form.jobTitle,
        organization: needsOrg ? form.organization : null,
      };
      if (editUser) { await userApi.update(editUser._id, payload); toast.success('User updated'); }
      else { await userApi.create({ ...payload, email: form.email, password: form.password }); toast.success('User created'); }
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={editUser ? 'Edit User' : 'Add User'}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jane Doe" />
        <Input label="Email" type="email" required disabled={!!editUser} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@company.com" />
        {!editUser && <Input label="Temporary password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" />}
        <div className="grid grid-cols-2 gap-4">
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Input label="Job title" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="e.g. Manager" />
        </div>
        {needsOrg ? (
          <Select label="Organization" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })}>
            <option value="">Select an organization…</option>
            {orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
          </Select>
        ) : (
          <p className="rounded-lg bg-violet-50 dark:bg-violet-500/10 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">Admins are global and not tied to a single organization.</p>
        )}
        {editUser && <p className="text-xs text-slate-400">Email can't be changed. Use "Reset password" to set a new password.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{editUser ? 'Save changes' : 'Create user'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try { await userApi.resetPassword(user._id, form.password); toast.success(`Password reset for ${user.name}`); onClose(); }
    catch (err) { toast.error(err.response?.data?.message || 'Reset failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Reset password — ${user.name}`} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-400">Set a new password for this user. Share it securely.</p>
        <Input label="New password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Input label="Confirm password" type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Reset password</Button>
        </div>
      </form>
    </Modal>
  );
}
