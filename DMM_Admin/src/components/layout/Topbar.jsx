import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Sun, Moon, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { useThemeStore } from '../../store/themeStore.js';
import { Avatar } from '../ui/primitives.jsx';

export default function Topbar({ onMenu }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 backdrop-blur-xl lg:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden items-center gap-2 md:flex">
        <span className="rounded-full bg-brand-50 dark:bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-600">Administrator Console</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button onClick={toggle} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Toggle theme">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <div className="relative ml-1">
          <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Avatar src={user?.avatar} name={user?.name} size="sm" />
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold leading-tight text-slate-700 dark:text-slate-200">{user?.name}</p>
              <p className="text-[11px] text-slate-400">Admin</p>
            </div>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-card">
                <button onClick={() => { setMenuOpen(false); navigate('/settings'); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Settings</button>
                <button onClick={() => { logout(); navigate('/login'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
