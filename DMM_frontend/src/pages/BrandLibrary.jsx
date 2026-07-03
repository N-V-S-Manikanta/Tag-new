import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Images, ExternalLink, Download, FileText, Link as LinkIcon, Play } from 'lucide-react';
import { libraryApi } from '../api/endpoints.js';
import { youtubeThumb } from '../lib/utils.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Card, Select, Skeleton, EmptyState } from '../components/ui/primitives.jsx';

const CATEGORIES = ['Flyer', 'Brochure', 'Branding Video', 'Image', 'Document', 'Other'];

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
          {items.map((it) => (
            <Card key={it._id} className="overflow-hidden">
              <div className="relative flex aspect-video items-center justify-center bg-slate-100 dark:bg-slate-800">
                {it.mediaType === 'image' ? <img src={it.url} alt={it.title} className="h-full w-full object-cover" />
                  : (it.kind === 'link' && youtubeThumb(it.url)) ? (
                    <a href={it.url} target="_blank" rel="noreferrer" className="group/thumb block h-full w-full">
                      <img src={youtubeThumb(it.url)} alt={it.title} className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover/thumb:bg-black/25">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg"><Play className="h-6 w-6 translate-x-0.5 fill-white" /></span>
                      </span>
                    </a>
                  )
                  : it.mediaType === 'video' ? <video src={it.url} className="h-full w-full object-cover" muted />
                  : it.kind === 'link' ? <LinkIcon className="h-10 w-10 text-slate-400" />
                  : <FileText className="h-10 w-10 text-slate-400" />}
                <span className="absolute left-2 top-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white">{it.category}</span>
              </div>
              <div className="p-4">
                <p className="truncate font-semibold text-slate-800 dark:text-white">{it.title}</p>
                {it.description && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{it.description}</p>}
                <a href={it.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
                  {it.kind === 'link' ? <><ExternalLink className="h-3.5 w-3.5" /> Open link</> : <><Download className="h-3.5 w-3.5" /> View / download</>}
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
