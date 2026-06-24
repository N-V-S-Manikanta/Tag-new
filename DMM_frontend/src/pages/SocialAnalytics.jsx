import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Linkedin, Instagram, Youtube, Facebook } from 'lucide-react';
import { analyticsApi } from '../api/endpoints.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import AnalyticsReport from '../components/AnalyticsReport.jsx';
import CompetitorBenchmark from '../components/CompetitorBenchmark.jsx';
import { cn } from '../lib/utils.js';

const PLATFORMS = [
  { key: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
  { key: 'Instagram', icon: Instagram, color: '#E1306C' },
  { key: 'YouTube', icon: Youtube, color: '#FF0000' },
  { key: 'Facebook', icon: Facebook, color: '#1877F2' },
];

export default function SocialAnalytics() {
  const [platform, setPlatform] = useState('LinkedIn');
  const { data: report, isLoading } = useQuery({ queryKey: ['report', platform], queryFn: () => analyticsApi.report(platform) });

  return (
    <div>
      <PageHeader title="Social Media Analytics" subtitle="Week-over-week performance across your social platforms." />
      <div className="mb-5 flex flex-wrap gap-2">
        {PLATFORMS.map(({ key, icon: Icon, color }) => (
          <button key={key} onClick={() => setPlatform(key)}
            className={cn('flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition',
              platform === key ? 'border-transparent text-white shadow-soft' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-300')}
            style={platform === key ? { background: color } : undefined}>
            <Icon className="h-4 w-4" /> {key}
          </button>
        ))}
      </div>
      <AnalyticsReport report={report} isLoading={isLoading} />
      {platform === 'LinkedIn' && <CompetitorBenchmark platform={platform} />}
    </div>
  );
}
