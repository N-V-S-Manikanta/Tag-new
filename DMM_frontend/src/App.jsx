import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { useThemeStore, applyTheme } from './store/themeStore.js';
import { applyBrand } from './lib/brand.js';
import { authApi } from './api/endpoints.js';

import AppLayout from './components/layout/AppLayout.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';

import NotConfigured from './pages/NotConfigured.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Templates from './pages/Templates.jsx';
import Assets from './pages/Assets.jsx';
import BrandLibrary from './pages/BrandLibrary.jsx';
import Events from './pages/Events.jsx';
import Signage from './pages/Signage.jsx';
import Profile from './pages/Profile.jsx';
import SocialHandlers from './pages/SocialHandlers.jsx';
import PremiumPacks from './pages/PremiumPacks.jsx';
import Approvals from './pages/Approvals.jsx';
import Planner from './pages/Planner.jsx';
import Assistant from './pages/Assistant.jsx';
import ApprovalDetail from './pages/ApprovalDetail.jsx';
import ApprovalAnalytics from './pages/ApprovalAnalytics.jsx';
import Calendar from './pages/Calendar.jsx';
import SocialAnalytics from './pages/SocialAnalytics.jsx';
import Reports from './pages/Reports.jsx';
import Notifications from './pages/Notifications.jsx';
import Settings from './pages/Settings.jsx';

// Until a newly-created USER completes their profile (name, phone, skills,
// tools, pages handled), every page redirects to /profile.
function ProfileGate({ children }) {
  const { user } = useAuthStore();
  const location = useLocation();
  if (user && user.role === 'USER' && !user.profileCompletedAt && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }
  return children;
}

export default function App() {
  const { token, fetchMe, user } = useAuthStore();
  const { theme } = useThemeStore();
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => { applyTheme(theme); }, [theme]);
  // In dark mode, tint the brand accent with the logged-in org's colors.
  useEffect(() => { applyBrand(user?.organization, theme); }, [theme, user?.organization]);

  useEffect(() => {
    (async () => {
      try {
        const status = await authApi.setupStatus();
        setNeedsSetup(status.needsSetup);
        if (!status.needsSetup && token) await fetchMe();
      } catch {
        // backend unreachable — fall through to login
      }
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

  // The platform hasn't been initialised yet — the first admin is created in the
  // separate Admin portal, not here.
  if (needsSetup) return <NotConfigured />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route element={<ProtectedRoute><ProfileGate><AppLayout /></ProfileGate></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/brand-library" element={<BrandLibrary />} />
        <Route path="/events" element={<Events />} />
        <Route path="/signage" element={<Signage />} />
        <Route path="/social-handlers" element={<SocialHandlers />} />
        <Route path="/premium-packs" element={<PremiumPacks />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/approvals/:id" element={<ApprovalDetail />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/social-analytics" element={<SocialAnalytics />} />
        <Route path="/approval-analytics" element={<ApprovalAnalytics />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
