import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Linkedin, Instagram, Youtube, Facebook } from 'lucide-react';
import { analyticsApi, organizationApi } from '../api/endpoints.js';
import { useAuthStore } from '../store/authStore.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import AnalyticsReport from '../components/AnalyticsReport.jsx';
import LinkedInView from '../components/LinkedInView.jsx';
import { cn } from '../lib/utils.js';

const PLATFORMS = [
  { key: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
  { key: 'Instagram', icon: Instagram, color: '#E1306C' },
  { key: 'YouTube', icon: Youtube, color: '#FF0000' },
  { key: 'Facebook', icon: Facebook, color: '#1877F2' },
];

export default function SocialAnalytics() {
  const { user } = useAuthStore();
  const ownOrgId = user?.organization?._id || user?.organization || '';
  const [platform, setPlatform] = useState('LinkedIn');
  const [orgId, setOrgId] = useState(ownOrgId);

  const { data: orgData } = useQuery({ queryKey: ['org-options'], queryFn: organizationApi.options });
  const orgs = orgData?.organizations || [];
  const isLinkedIn = platform === 'LinkedIn';
  const { data: report, isLoading } = useQuery({
    queryKey: ['report', platform, orgId],
    queryFn: () => analyticsApi.report(platform, orgId),
    enabled: !isLinkedIn, // the LinkedIn view fetches its own ranged report
  });
  // Uploading LinkedIn exports is for admins; regular users get the full view read-only.
  const canUpload = user?.role === 'ADMIN' || user?.role === 'CEO';

  return (
    <div>
      <PageHeader title="Social Media Analytics" subtitle="Week-over-week performance across every organization." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(({ key, icon: Icon, color }) => (
            <button key={key} onClick={() => setPlatform(key)}
              className={cn('flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition',
                platform === key ? 'border-transparent text-white shadow-soft' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-300')}
              style={platform === key ? { background: color } : undefined}>
              <Icon className="h-4 w-4" /> {key}
            </button>
          ))}
        </div>
        <select className="input-base h-10 w-auto cursor-pointer text-sm font-semibold" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          {orgs.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
        </select>
      </div>
      {isLinkedIn ? (
        <LinkedInView orgId={orgId} canUpload={canUpload} />
      ) : (
        <AnalyticsReport report={report} isLoading={isLoading} />
      )}
    </div>
  );
}
