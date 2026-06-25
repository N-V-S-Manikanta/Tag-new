import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, Activity, BarChart3, CalendarDays, Settings, X, ShieldCheck, CheckSquare, Images, Share2, ShoppingBag, Target } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { useAuthStore } from '../../store/authStore.js';

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/organizations', label: 'Organizations', icon: Building2 },
  { to: '/users', label: 'User Management', icon: Users },
  { to: '/approvals', label: 'Approvals', icon: CheckSquare },
  { to: '/analytics', label: 'Social Analytics', icon: BarChart3 },
  { to: '/social-accounts', label: 'Social Handlers', icon: Share2 },
  { to: '/brand-library', label: 'Brand Library', icon: Images },
  { to: '/purchases', label: 'Premium Packs', icon: ShoppingBag },
  { to: '/goals', label: 'Yearly Goals', icon: Target },
  { to: '/calendar', label: 'Posting Calendar', icon: CalendarDays },
  { to: '/activity', label: 'Activity Logs', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// The "t@g" wordmark with the @ in brand orange.
const Wordmark = () => (
  <span className="lowercase tracking-tight">t<span className="text-brand-500">@</span>g</span>
);

export default function Sidebar({ open, onClose }) {
  const { user } = useAuthStore();
  const linkClass = ({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active');

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/5 bg-gradient-to-b from-[#0b2350] to-[#08152e] transition-transform lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
              <img src="/logo.png" alt="t@g" className="h-full w-full object-contain p-1" />
            </div>
            <div>
              <p className="text-base font-extrabold leading-tight text-white"><Wordmark /></p>
              <p className="text-[11px] text-slate-400">Admin Console</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={onClose} className={linkClass}>
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/5 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20 text-xs font-bold text-brand-300">
              {user?.name?.[0]}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{user?.name}</p>
              <p className="text-[11px] text-slate-400">Administrator</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
