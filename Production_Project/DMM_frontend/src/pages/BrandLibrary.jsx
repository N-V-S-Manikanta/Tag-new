import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Images, ExternalLink, Download, FileText, Link as LinkIcon, Play, Globe, Film } from 'lucide-react';
import { libraryApi, linkApi } from '../api/endpoints.js';
import { youtubeThumb, cn } from '../lib/utils.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Card, Select, Skeleton, EmptyState } from '../components/ui/primitives.jsx';

const CATEGORIES = ['Flyer', 'Brochure', 'Branding Video', 'Image', 'Document', 'Other'];

const TYPE_META = {
  Video: { tone: 'from-red-500/20 to-rose-500/5 text-red-500', icon: Film },
  PDF: { tone: 'from-rose-500/20 to-orange-500/5 text-rose-500', icon: FileText },
  Document: { tone: 'from-indigo-500/20 to-blue-500/5 text-indigo-500', icon: FileText },
  Link: { tone: 'from-brand-500/20 to-amber-500/5 text-brand-500', icon: Globe },
  Image: { tone: 'from-emerald-500/20 to-teal-500/5 text-emerald-500', icon: Images },
};
const itemType = (item) => {
  if (item.mediaType === 'image') return 'Image';
  if (item.mediaType === 'video') return 'Video';
  if (item.kind === 'link') return 'Link';
  return (item.url || '').toLowerCase().endsWith('.pdf') ? 'PDF' : 'Document';
};

function Placeholder({ type, label }) {
  const meta = TYPE_META[type] || TYPE_META.Document;
  const Icon = meta.icon;
  return (
    <div className={cn('flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br px-4 text-center', meta.tone)}>
      <Icon className="h-10 w-10" />
      {label && <span className="max-w-full truncate text-xs font-semibold opacity-80">{label}</span>}
    </div>
  );
}

function LinkThumb({ url }) {
  const { data, isLoading } = useQuery({ queryKey: ['link-preview', url], queryFn: () => linkApi.preview(url), staleTime: Infinity, retry: false });
  if (data?.image) {
    return (
      <>
        <img src={data.image} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white"><ExternalLink className="h-3 w-3" />{data.siteName}</span>
      </>
    );
  }
  return <Placeholder type="Link" label={isLoading ? 'Loading preview…' : (data?.siteName || 'External link')} />;
}

function BrandCard({ item }) {
  const ytThumb = item.kind === 'link' ? youtubeThumb(item.url) : null;
  const isLink = item.kind === 'link';
  const type = ytThumb ? 'Video' : itemType(item);
  return (
    <Card className="group overflow-hidden">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800">
        {item.mediaType === 'image' ? (
          <img src={item.url} alt={item.title} className="h-full w-full object-cover" />
        ) : ytThumb ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="group/thumb block h-full w-full">
            <img src={ytThumb} alt={item.title} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover/thumb:bg-black/25">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg"><Play className="h-6 w-6 translate-x-0.5 fill-white" /></span>
            </span>
          </a>
        ) : item.mediaType === 'video' ? (
          <video src={item.url} className="h-full w-full object-cover" muted />
        ) : isLink ? (
          <LinkThumb url={item.url} />
        ) : (
          <Placeholder type={type} label={type} />
        )}
        <span className="absolute left-2 top-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">{item.category}</span>
        <span className="absolute right-2 top-2 rounded-md bg-white/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 backdrop-blur-sm dark:bg-slate-900/80 dark:text-slate-300">{type}</span>
      </div>
      <div className="p-4">
        <p className="truncate font-semibold text-slate-800 dark:text-white">{item.title}</p>
        {item.description && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.description}</p>}
        <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
          {isLink ? <><ExternalLink className="h-3.5 w-3.5" /> Open link</> : <><Download className="h-3.5 w-3.5" /> View / download</>}
        </a>
      </div>
    </Card>
  );
}

export default function BrandLibrary() {
  const [category, setCategory] = useState('All');
  const { data, isLoading } = useQuery({ queryKey: ['brand', category], queryFn: () => libraryApi.brand({ category }) });
  const items = data?.items || [];

  return (
    <div>
      <PageHeader title="Brand Library" subtitle="Flyers, brochures, branding videos and marketing material for your organization — view, download or share." />
      <div className="mb-5">
        <Select className="max-w-[220px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Images} title="Nothing here yet" description="Your admin hasn't added brand material for this category yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => <BrandCard key={it._id} item={it} />)}
        </div>
      )}
    </div>
  );
}
