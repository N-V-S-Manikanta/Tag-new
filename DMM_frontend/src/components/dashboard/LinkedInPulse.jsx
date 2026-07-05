import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Linkedin, Eye, UserPlus, Zap } from 'lucide-react';
import { analyticsApi } from '../../api/endpoints.js';
import { Card } from '../ui/primitives.jsx';
import { formatNumber } from '../../lib/utils.js';

// The three headline LinkedIn numbers for this organization over the last 15
// days — the essentials, with the full LinkedIn view one click away.
export default function LinkedInPulse({ orgId }) {
  const { data } = useQuery({ queryKey: ['analytics-pulse'], queryFn: analyticsApi.pulse, enabled: !!orgId });
  const row = (data?.organizations || []).find((o) => String(o.organization._id) === String(orgId));
  if (!row?.hasData) return null;

  const metrics = [
    { label: 'Impressions', value: formatNumber(row.impressions), icon: Eye },
    { label: 'New followers', value: row.newFollowers > 0 ? `+${formatNumber(row.newFollowers)}` : '0', icon: UserPlus },
    { label: 'Engagement rate', value: row.engagementRate ? `${row.engagementRate.toFixed(2)}%` : '—', icon: Zap },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0A66C2] text-white"><Linkedin className="h-4 w-4" /></span>
          LinkedIn <span className="text-sm font-normal text-slate-400">· last {data?.days || 15} days</span>
        </h3>
        <Link to="/social-analytics" className="text-sm font-medium text-brand-600 hover:text-brand-700">Full analytics →</Link>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-slate-100 p-3.5 text-center dark:border-slate-800">
            <Icon className="mx-auto mb-1.5 h-4 w-4 text-[#0A66C2]" />
            <p className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-2xl">{value}</p>
            <p className="text-[11px] font-medium text-slate-400">{label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
