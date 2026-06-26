import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { useThemeStore, applyTheme } from './store/themeStore.js';
import { authApi } from './api/endpoints.js';

import AppLayout from './components/layout/AppLayout.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';

import Setup from './pages/Setup.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Organizations from './pages/Organizations.jsx';
import Users from './pages/Users.jsx';
import Approvals from './pages/Approvals.jsx';
import Analytics from './pages/Analytics.jsx';
import BrandLibrary from './pages/BrandLibrary.jsx';
import SocialAccounts from './pages/SocialAccounts.jsx';
import Websites from './pages/Websites.jsx';
import Purchases from './pages/Purchases.jsx';
import Goals from './pages/Goals.jsx';
import Calendar from './pages/Calendar.jsx';
import ActivityLogs from './pages/ActivityLogs.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { token, fetchMe } = useAuthStore();
  const { theme } = useThemeStore();
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const status = await authApi.setupStatus();
        setNeedsSetup(status.needsSetup);
        if (!status.needsSetup && token) await fetchMe();
      } catch { /* backend unreachable */ }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (needsSetup) {
    return (
      <Routes>
        <Route path="/setup" element={<Setup onDone={() => setNeedsSetup(false)} />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/setup" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Overview />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/users" element={<Users />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/brand-library" element={<BrandLibrary />} />
        <Route path="/social-accounts" element={<SocialAccounts />} />
        <Route path="/websites" element={<Websites />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/activity" element={<ActivityLogs />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
