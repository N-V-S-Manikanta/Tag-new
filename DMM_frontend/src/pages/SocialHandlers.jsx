import { useQuery } from '@tanstack/react-query';
import { Share2, Mail, Phone, Star, Users, ExternalLink } from 'lucide-react';
import { libraryApi } from '../api/endpoints.js';
import PageHeader from '../components/layout/PageHeader.jsx';
import { Card, Skeleton, EmptyState } from '../components/ui/primitives.jsx';

export default function SocialHandlers() {
  const { data, isLoading } = useQuery({ queryKey: ['social-accounts'], queryFn: () => libraryApi.socialAccounts() });
  const accounts = data?.accounts || [];

  return (
    <div>
      <PageHeader title="Social Media Handlers" subtitle="Who manages each of your social platforms — owners, linked emails and contact details." />
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Share2} title="No accounts listed yet" description="Your admin hasn't added social media handler details for your organization." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {accounts.map((a) => (
            <Card key={a._id} className="p-5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 dark:text-white">{a.platform}</span>
                {a.accountName && <span className="text-sm text-slate-500">· {a.accountName}</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {a.ownerName && <div><p className="text-xs text-slate-400">Owner</p><p className="font-medium text-slate-700 dark:text-slate-200">{a.ownerName}</p></div>}
                {a.ownerEmail && <div><p className="text-xs text-slate-400">Owner email</p><p className="font-medium text-slate-700 dark:text-slate-200">{a.ownerEmail}</p></div>}
                <div><p className="text-xs text-slate-400">Rating</p><p className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">{a.rating || 0}<Star className="h-3.5 w-3.5 text-amber-500" /></p></div>
                <div><p className="text-xs text-slate-400">People with access</p><p className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200"><Users className="h-3.5 w-3.5" />{a.accessCount || 0}</p></div>
              </div>
              {a.profileUrl && <a href={a.profileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"><ExternalLink className="h-3.5 w-3.5" />{a.profileUrl}</a>}
              {a.linkedEmails?.length > 0 && <p className="mt-2 text-xs text-slate-400">Linked emails: <span className="text-slate-600 dark:text-slate-300">{a.linkedEmails.join(', ')}</span></p>}
              {a.handlers?.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Handlers</p>
                  <div className="space-y-1.5">
                    {a.handlers.map((h, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-3 text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{h.name}{h.role ? ` · ${h.role}` : ''}</span>
                        {h.email && <a href={`mailto:${h.email}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600"><Mail className="h-3 w-3" />{h.email}</a>}
                        {h.phone && <a href={`tel:${h.phone}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600"><Phone className="h-3 w-3" />{h.phone}</a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
