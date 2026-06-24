import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users as UsersIcon, ShieldCheck, Crown, User as UserIcon, Send,
  Activity, ArrowRight, BarChart3, CalendarDays,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { organizationApi, userApi, activityApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/authStore.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Card, Avatar, Skeleton, EmptyState } from '../components/ui/primitives.jsx';
import { timeAgo, formatNumber } from '../lib/utils.js';

const ACTIVITY_LABEL = {
  TEMPLATE_UPLOAD: 'uploaded a template', ASSET_UPLOAD: 'uploaded an asset',
  APPROVAL_SUBMISSION: 'submitted a request', APPROVAL_APPROVED: 'approved content',
  APPROVAL_REJECTED: 'rejected content', APPROVAL_RESUBMITTED: 'resubmitted content',
  POST_COMPLETION: 'marked content posted', USER_CREATED: 'created a user',
  USER_UPDATED: 'updated a user', USER_DEACTIVATED: 'removed a user',
  ANALYTICS_UPDATED: 'updated analytics',
};

export default function Overview() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: orgData, isLoading: lo } = useQuery({ queryKey: ['organizations', 'overview'], queryFn: () => organizationApi.list() });
  const { data: userData } = useQuery({ queryKey: ['users', 'overview'], queryFn: () => userApi.list() });
  const { data: activityData } = useQuery({ queryKey: ['activity', 'overview'], queryFn: () => activityApi.list({ limit: 8 }) });

  const orgs = orgData?.organizations || [];
  const users = userData?.users || [];
  const counts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});
  const totalPosts = orgs.reduce((a, o) => a + (o.postCount || 0), 0);
  const activity = activityData?.logs || [];

  const cards = [
    { label: 'Organizations', value: orgs.length, icon: Building2, tone: 'text-brand-600 bg-brand-50 dark:bg-brand-500/10' },
    { label: 'Total Users', value: users.length, icon: UsersIcon, tone: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10' },
    { label: 'Admins', value: counts.ADMIN || 0, icon: ShieldCheck, tone: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
    { label: 'CEOs', value: counts.CEO || 0, icon: Crown, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Users', value: counts.USER || 0, icon: UserIcon, tone: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10' },
    { label: 'Total Posts', value: totalPosts, icon: Send, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${user?.name?.split(' ')[0]} 👋`} subtitle="Platform-wide administration overview." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {lo ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : cards.map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card p-4">
              <div className={`mb-2 w-fit rounded-lg p-2 ${c.tone}`}><c.icon className="h-4 w-4" /></div>
              <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{formatNumber(c.value)}</p>
              <p className="text-xs text-slate-400">{c.label}</p>
            </motion.div>
          ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Organizations summary */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white">Organizations</h3>
            <button onClick={() => navigate('/organizations')} className="text-sm font-medium text-brand-600 hover:text-brand-700">Manage →</button>
          </div>
          {orgs.length === 0 ? (
            <EmptyState icon={Building2} title="No organizations yet" description="Create one to start onboarding teams."
              action={<button onClick={() => navigate('/organizations')} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">New Organization</button>} />
          ) : (
            <div className="space-y-2">
              {orgs.slice(0, 6).map((o) => (
                <div key={o._id} className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                  {o.logo ? <img src={o.logo} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    : <div className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: o.color }}>{o.name[0]?.toUpperCase()}</div>}
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-700 dark:text-slate-200">{o.name}</p><p className="text-xs text-slate-400">{o.memberCount} members · {o.postCount} posts</p></div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{o.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick actions */}
        <Card className="p-5">
          <h3 className="mb-4 font-bold text-slate-800 dark:text-white">Quick Actions</h3>
          <div className="space-y-2">
            <QuickAction icon={Building2} label="Manage organizations" onClick={() => navigate('/organizations')} />
            <QuickAction icon={UsersIcon} label="Manage users" onClick={() => navigate('/users')} />
            <QuickAction icon={BarChart3} label="Update social analytics" onClick={() => navigate('/analytics')} />
            <QuickAction icon={CalendarDays} label="View posting calendar" onClick={() => navigate('/calendar')} />
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="p-5">
        <h3 className="mb-4 font-bold text-slate-800 dark:text-white">Recent Activity (all organizations)</h3>
        {activity.length === 0 ? (
          <EmptyState icon={Activity} title="No activity yet" description="Platform actions will appear here." />
        ) : (
          <div className="space-y-1">
            {activity.map((log) => (
              <div key={log._id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <Avatar src={log.user?.avatar} name={log.user?.name} size="sm" />
                <p className="flex-1 text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-700 dark:text-slate-200">{log.user?.name}</span> {ACTIVITY_LABEL[log.action] || 'did something'}</p>
                <span className="text-[11px] text-slate-400">{timeAgo(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const QuickAction = ({ icon: Icon, label, onClick }) => (
  <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 text-left text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-500/5">
    <Icon className="h-4 w-4 text-brand-600" /> {label}
    <ArrowRight className="ml-auto h-4 w-4 text-slate-300" />
  </button>
);
