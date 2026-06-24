import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Search, Inbox, Images as ImagesIcon } from 'lucide-react';
import { approvalApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/authStore.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, Input, Select, Badge, Avatar, Skeleton, EmptyState } from '../components/ui/primitives.jsx';
import CreateApprovalModal from '../components/approvals/CreateApprovalModal.jsx';
import { formatDate } from '../lib/utils.js';

const STATUSES = ['All', 'PENDING', 'APPROVED', 'REJECTED', 'RESUBMITTED', 'POSTED'];
const PLATFORMS = ['All', 'LinkedIn', 'Instagram', 'YouTube', 'Facebook'];

export default function Approvals() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  // Allow the dashboard cards to deep-link into a pre-filtered view (?status=PENDING).
  const initialStatus = STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : 'All';
  const [filters, setFilters] = useState({ search: '', status: initialStatus, platform: 'All', from: '', to: '' });
  const [showCreate, setShowCreate] = useState(false);
  const hasDateFilter = filters.from || filters.to;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['approvals', filters],
    queryFn: () => approvalApi.list({ ...filters, limit: 48 }),
  });
  const requests = data?.requests || [];

  return (
    <div>
      <PageHeader
        title={['ADMIN', 'CEO'].includes(user?.role) ? 'Approval Panel' : 'My Approval Requests'}
        subtitle={['ADMIN', 'CEO'].includes(user?.role) ? 'Review, approve or request changes to content.' : 'Create and track your content approvals.'}
        actions={<Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Request</Button>}
      />

      {/* Filters */}
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search requests..." className="pl-9" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          {STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </Select>
        <Select value={filters.platform} onChange={(e) => setFilters({ ...filters, platform: e.target.value })}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p === 'All' ? 'All Platforms' : p}</option>)}
        </Select>
      </div>

      {/* Date range */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">From date</span>
          <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="w-44" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">To date</span>
          <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="w-44" />
        </label>
        {hasDateFilter && (
          <button onClick={() => setFilters({ ...filters, from: '', to: '' })} className="mb-0.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            Clear dates
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState icon={Inbox} title="No requests found" description="Create a new approval request to get started."
          action={<Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Request</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((r, i) => (
            <motion.div key={r._id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="group cursor-pointer overflow-hidden transition hover:shadow-glow" onClick={() => navigate(`/approvals/${r._id}`)}>
                <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {r.images?.[0] ? (
                    <img src={r.images[0].url} alt={r.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><ImagesIcon className="h-10 w-10 text-slate-300" /></div>
                  )}
                  <Badge status={r.status} className="absolute right-2 top-2">{r.status}</Badge>
                  {r.images?.length > 1 && (
                    <span className="absolute bottom-2 right-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-xs font-medium text-white">+{r.images.length - 1}</span>
                  )}
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge>{r.platform}</Badge>
                    <span className="text-xs text-slate-400">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="truncate font-semibold text-slate-800 dark:text-white">{r.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{r.caption}</p>
                  <div className="mt-3 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <Avatar src={r.createdBy?.avatar} name={r.createdBy?.name} size="sm" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{r.createdBy?.name}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {showCreate && <CreateApprovalModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}
