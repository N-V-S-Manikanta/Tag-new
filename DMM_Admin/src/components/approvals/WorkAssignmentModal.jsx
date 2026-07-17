import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { BriefcaseBusiness, Palette, Send } from 'lucide-react';
import { organizationApi, userApi, workAssignmentApi } from '../../api/endpoints.js';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input, Select } from '../ui/primitives.jsx';
import { cn } from '../../lib/utils.js';

const ASSIGNEE_TYPES = [
  { key: 'DESIGNER', label: 'Designer', icon: Palette, hint: 'Creative and production work' },
  { key: 'SOCIAL_HANDLER', label: 'Social Handler', icon: Send, hint: 'Platform-specific publishing work' },
];

const PLATFORMS = ['LinkedIn', 'Instagram', 'YouTube', 'Facebook'];

export default function WorkAssignmentModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ organization: '', assigneeType: 'DESIGNER', assigneeId: '', platform: '', title: '', description: '' });
  const [loading, setLoading] = useState(false);

  const { data: orgData } = useQuery({ queryKey: ['work-assign-orgs'], queryFn: () => organizationApi.list() });
  const orgs = orgData?.organizations || [];

  const { data: usersData } = useQuery({
    queryKey: ['work-assign-users', form.organization, form.assigneeType],
    queryFn: () => userApi.list(
      form.assigneeType === 'SOCIAL_HANDLER' || !form.organization
        ? { role: 'USER' }
        : { role: 'USER', organization: form.organization }
    ),
  });
  const users = usersData?.users || [];

  const candidates = useMemo(() => {
    let list = users.filter((u) => u.role === 'USER' && u.userType === form.assigneeType);
    if (form.assigneeType !== 'SOCIAL_HANDLER' && form.organization) {
      list = list.filter((u) => String(u.organization?._id || u.organization || '') === String(form.organization));
    }
    if (form.assigneeType === 'SOCIAL_HANDLER' && form.organization) {
      list = list.filter((u) => (u.handles || []).some((h) => String(h.organization?._id || h.organization) === String(form.organization)
        && (!form.platform || (h.platforms || []).includes(form.platform))));
    }
    return list;
  }, [users, form.organization, form.assigneeType, form.platform]);

  const submit = async () => {
    if (!form.organization) { toast.error('Please choose an organization'); return; }
    if (!form.assigneeId) { toast.error('Please choose an assignee'); return; }
    if (!form.title.trim()) { toast.error('Please add a title'); return; }
    if (form.assigneeType === 'SOCIAL_HANDLER' && !form.platform) { toast.error('Choose a platform for social-handler work'); return; }

    setLoading(true);
    try {
      await workAssignmentApi.create({
        organization: form.organization,
        assigneeId: form.assigneeId,
        platform: form.platform,
        title: form.title,
        description: form.description,
      });
      toast.success('Work assigned successfully');
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Assign Work" size="lg">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Organization" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value, assigneeId: '' })}>
            <option value="">— Select organization —</option>
            {orgs.map((org) => <option key={org._id} value={org._id}>{org.name}</option>)}
          </Select>
          <Select label="Platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value, assigneeId: '' })}>
            <option value="">General / not platform specific</option>
            {PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
          </Select>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Assign to</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {ASSIGNEE_TYPES.map((type) => {
              const Icon = type.icon;
              const active = form.assigneeType === type.key;
              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => setForm({ ...form, assigneeType: type.key, assigneeId: '' })}
                  className={cn(
                    'rounded-2xl border-2 p-4 text-left transition',
                    active ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10' : 'border-slate-200 hover:border-brand-300 dark:border-slate-700'
                  )}
                >
                  <Icon className={cn('h-5 w-5', active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400')} />
                  <p className="mt-2 text-sm font-bold text-slate-800 dark:text-white">{type.label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{type.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        <Select label={form.assigneeType === 'SOCIAL_HANDLER' ? 'Social handler' : 'Designer'} value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
          <option value="">— Select assignee —</option>
          {candidates.map((user) => <option key={user._id} value={user._id}>{user.name}{user.jobTitle ? ` · ${user.jobTitle}` : ''}</option>)}
        </Select>

        {form.assigneeType === 'SOCIAL_HANDLER' && form.organization && form.platform && candidates.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400 dark:border-slate-700">
            No social handlers matched this organization/platform yet.
          </p>
        )}

        <Input label="Work title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Create placement story carousel" />
        <textarea
          className="input-base min-h-[90px]"
          placeholder="Add a short brief or instructions for the person receiving the work"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={submit}><BriefcaseBusiness className="h-4 w-4" /> Assign Work</Button>
        </div>
      </div>
    </Modal>
  );
}