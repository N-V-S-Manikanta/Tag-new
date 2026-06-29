import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileImage, Images, CheckSquare, BarChart3, CalendarDays,
  FileText, Bell, Settings, X, TrendingUp, Palette, Share2, ShoppingBag,
} from 'lucide-react';
import { cn, roleLabel } from '../../lib/utils.js';
import { useAuthStore } from '../../store/authStore.js';

const MAIN_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/templates', label: 'Templates', icon: FileImage },
  { to: '/assets', label: 'Assets', icon: Images },
  { to: '/brand-library', label: 'Brand Library', icon: Palette },
  { to: '/approvals', label: 'Approvals', icon: CheckSquare },
  // Management info — only useful to the org head (CEO), hidden from regular users.
  { to: '/social-handlers', label: 'Social Handlers', icon: Share2, roles: ['CEO'] },
  { to: '/premium-packs', label: 'Premium Packs', icon: ShoppingBag, roles: ['CEO'] },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/social-analytics', label: 'Social Analytics', icon: TrendingUp },
  { to: '/approval-analytics', label: 'Approval Analytics', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// The "t@g" wordmark with the @ in brand orange.
const Wordmark = () => (
  <span className="lowercase tracking-tight">t<span className="text-brand-500">@</span>g</span>
);

export default function Sidebar({ open, onClose }) {
  const { user } = useAuthStore();
  const org = user?.organization;

  const linkClass = ({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active');

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/5 bg-gradient-to-b from-[#0b2350] to-[#08152e] transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
              {org?.logo
                ? <img src={org.logo} alt={org.name} className="h-full w-full object-cover" />
                : <img src="/logo.png" alt="t@g" className="h-full w-full object-contain p-1" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold leading-tight text-white">
                {org?.name || <Wordmark />}
              </p>
              <p className="text-[11px] text-slate-400">Marketing Suite</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-white/10 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {MAIN_NAV.filter((i) => !i.roles || i.roles.includes(user?.role)).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={onClose} className={linkClass}>
              <Icon className="h-[18px] w-[18px] shrink-0" />
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
              <p className="text-[11px] text-slate-400">{roleLabel(user)}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
