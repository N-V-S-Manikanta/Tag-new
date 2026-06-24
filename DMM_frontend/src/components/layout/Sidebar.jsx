import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileImage, Images, CheckSquare, BarChart3, CalendarDays,
  FileText, Bell, Settings, X, TrendingUp,
} from 'lucide-react';
import { cn, initials } from '../../lib/utils.js';
import { useAuthStore } from '../../store/authStore.js';

const MAIN_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/templates', label: 'Templates', icon: FileImage },
  { to: '/assets', label: 'Assets', icon: Images },
  { to: '/approvals', label: 'Approvals', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/social-analytics', label: 'Social Analytics', icon: TrendingUp },
  { to: '/approval-analytics', label: 'Approval Analytics', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuthStore();
  const org = user?.organization;

  const linkClass = ({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active');

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {org?.logo ? (
              <img src={org.logo} alt={org.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-glow" style={{ background: org?.color ? `linear-gradient(135deg, ${org.color}, ${org.color}cc)` : undefined }}>
                <span className="text-sm font-extrabold text-white">{org?.name ? initials(org.name) : 'DMM'}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold leading-tight text-slate-800 dark:text-white">{org?.name || 'DMM Platform'}</p>
              <p className="text-[11px] text-slate-400">Marketing Suite</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {MAIN_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={onClose} className={linkClass}>
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 dark:border-slate-800 p-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-500/20 text-xs font-bold text-brand-600">
              {user?.role?.[0]}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{user?.name}</p>
              <p className="text-[11px] text-slate-400">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
