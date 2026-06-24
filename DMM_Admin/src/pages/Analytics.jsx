import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Linkedin, Instagram, Youtube, Facebook, Save, BarChart3, PenLine, Trophy, Users } from 'lucide-react';
import { analyticsApi } from '../api/endpoints.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import OrgPicker from '../components/OrgPicker.jsx';
import AnalyticsReport from '../components/AnalyticsReport.jsx';
import CompetitorManager from '../components/CompetitorManager.jsx';
import OrgCompare from '../components/OrgCompare.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, Input } from '../components/ui/primitives.jsx';
import { cn } from '../lib/utils.js';

const PLATFORMS = [
  { key: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
  { key: 'Instagram', icon: Instagram, color: '#E1306C' },
  { key: 'YouTube', icon: Youtube, color: '#FF0000' },
  { key: 'Facebook', icon: Facebook, color: '#1877F2' },
];

export default function Analytics() {
  const [tab, setTab] = useState('org');
  return (
    <div>
      <PageHeader title="Social Media Analytics" subtitle="Enter weekly metrics, track week-over-week changes, and compare organizations." />
      <div className="mb-5 inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        <TabBtn active={tab === 'org'} onClick={() => setTab('org')} icon={BarChart3}>Per organization</TabBtn>
        <TabBtn active={tab === 'compare'} onClick={() => setTab('compare')} icon={Trophy}>Compare organizations</TabBtn>
      </div>
      {tab === 'org' ? <OrgPicker>{(orgId) => <OrgAnalytics orgId={orgId} />}</OrgPicker> : <OrgCompare />}
    </div>
  );
}

const TabBtn = ({ active, onClick, icon: Icon, children }) => (
  <button onClick={onClick} className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition', active ? 'bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-300 shadow-soft' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>
    <Icon className="h-4 w-4" /> {children}
  </button>
);

function OrgAnalytics({ orgId }) {
  const [platform, setPlatform] = useState('LinkedIn');
  const [mode, setMode] = useState('report');
  const { data: report, isLoading } = useQuery({ queryKey: ['report', orgId, platform], queryFn: () => analyticsApi.report(platform, orgId) });

  // Competitor tracking is only offered for LinkedIn — fall back to the report
  // if the admin switches to a platform that doesn't have it.
  const showCompetitors = platform === 'LinkedIn';
  const selectPlatform = (key) => {
    setPlatform(key);
    if (key !== 'LinkedIn' && mode === 'competitors') setMode('report');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(({ key, icon: Icon, color }) => (
            <button key={key} onClick={() => selectPlatform(key)}
              className={cn('flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition',
                platform === key ? 'border-transparent text-white shadow-soft' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-300')}
              style={platform === key ? { background: color } : undefined}>
              <Icon className="h-4 w-4" /> {key}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <TabBtn active={mode === 'report'} onClick={() => setMode('report')} icon={BarChart3}>Report</TabBtn>
          <TabBtn active={mode === 'enter'} onClick={() => setMode('enter')} icon={PenLine}>Enter metrics</TabBtn>
          {showCompetitors && <TabBtn active={mode === 'competitors'} onClick={() => setMode('competitors')} icon={Users}>Competitors</TabBtn>}
        </div>
      </div>

      {mode === 'report' && <AnalyticsReport report={report} isLoading={isLoading} />}
      {mode === 'enter' && <MetricEntry orgId={orgId} platform={platform} report={report} />}
      {mode === 'competitors' && <CompetitorManager orgId={orgId} platform={platform} />}
    </div>
  );
}

function MetricEntry({ orgId, platform, report }) {
  const qc = useQueryClient();
  const groups = report?.groups || {};
  const labels = report?.labels || {};
  const pct = new Set(report?.percentFields || []);
  const latest = report?.latest;
  const [values, setValues] = useState({});

  useEffect(() => {
    const init = {};
    Object.values(groups).flat().forEach((f) => { init[f] = latest?.[f] ?? ''; });
    setValues(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, platform]);

  const saveMut = useMutation({
    mutationFn: () => analyticsApi.record({ platform, organization: orgId, ...values }),
    onSuccess: () => { toast.success(`${platform} metrics saved`); qc.invalidateQueries({ queryKey: ['report', orgId, platform] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
      <p className="text-sm text-slate-400">Enter this week's {platform} numbers. Each save is stored as a dated snapshot, so week-over-week change is tracked automatically.</p>
      {Object.entries(groups).map(([group, fields]) => (
        <Card key={group} className="p-5">
          <h3 className="mb-4 font-bold text-slate-800 dark:text-white">{group}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {fields.map((f) => (
              <Input key={f} label={labels[f]} type="number" min="0" step={pct.has(f) ? '0.1' : '1'}
                value={values[f] ?? ''} onChange={(e) => setValues({ ...values, [f]: e.target.value })} placeholder="0" />
            ))}
          </div>
        </Card>
      ))}
      <Button type="submit" loading={saveMut.isPending}><Save className="h-4 w-4" /> Save {platform} metrics</Button>
    </form>
  );
}
