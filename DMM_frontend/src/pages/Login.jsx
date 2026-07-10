import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Mail, Lock, ArrowRight, Sparkles, ChartColumn, Check, Clock3, Image as ImageIcon,
  Linkedin, Instagram, Facebook, Youtube,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/primitives.jsx';

// Entrance choreography — everything settles within ~3s; after that only the
// aurora and the card border keep moving (pure CSS, disabled by the global
// prefers-reduced-motion rule). MotionConfig handles reduced motion for the
// framer animations, which ignore that CSS rule.
const EASE = [0.22, 1, 0.36, 1];
const rise = (delay) => ({
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.7, delay, ease: EASE },
});
const itemAt = (delay) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: EASE },
});

// Uppercase micro-labels above the fields (leading-4 keeps the icon offset
// deterministic: 16px label + 6px gap → icon top at 35px).
const LABEL_CLS = 'text-[11px] font-bold uppercase tracking-[0.14em] leading-4 text-slate-500 dark:text-slate-400';

const PLATFORMS = [
  { icon: Linkedin, name: 'LinkedIn' },
  { icon: Instagram, name: 'Instagram' },
  { icon: Facebook, name: 'Facebook' },
  { icon: Youtube, name: 'YouTube' },
];

const timeGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// Approval status that flips from "In review" to "Approved" once, ~2.5s in —
// a tiny live demo of the approval workflow.
function StatusFlip() {
  return (
    <span className="relative ml-auto inline-flex shrink-0">
      <motion.span initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 2.4, duration: 0.25 }}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
        <Clock3 className="h-3 w-3" /> In review
      </motion.span>
      <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.55, type: 'spring', stiffness: 320, damping: 18 }}
        className="absolute right-0 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
        <Check className="h-3 w-3" /> Approved
      </motion.span>
    </span>
  );
}

const SPARK_LINE = 'M2 33 C14 31 22 26 32 27 C42 28 48 20 58 21 C68 22 74 12 86 13 C96 14 106 7 118 5';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const greeting = timeGreeting();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen">
        {/* Left brand panel — navy base + breathing aurora + hairline grid + grain */}
        <div className="relative isolate hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b2350] via-[#0a1f44] to-[#07152e] p-12 text-white lg:flex">
          <div aria-hidden className="login-aurora login-aurora-a" />
          <div aria-hidden className="login-aurora login-aurora-b" />
          <div aria-hidden className="login-grid absolute inset-0" />
          <div aria-hidden className="login-noise absolute inset-0" />
          <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_-1px_0_0_rgba(255,255,255,0.04)]" />

          <motion.div {...rise(0.15)} className="relative z-10 flex items-start justify-between">
            <div>
              <img src="/logo-light.png" alt="t@g" className="h-12 w-auto" />
              <p className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Campus Marketing Hub</p>
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/75 backdrop-blur-md xl:inline-flex">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              All systems live
            </span>
          </motion.div>

          <motion.div {...rise(0.24)} className="relative z-10 pb-6">
            <p className="mb-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300/90">
              <Sparkles className="h-3.5 w-3.5" /> Marketing OS — Nagarjuna Group
            </p>
            <h1 className="max-w-lg text-[2.6rem] font-extrabold leading-[1.08] tracking-tight">
              Manage your entire digital marketing{' '}
              <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-brand-200 bg-clip-text text-transparent">in one place.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
              Analytics, approvals, planning and brand assets for every campus — one login away.
            </p>

            {/* Live product preview — sparkline draws itself, an approval gets approved */}
            <div className="relative mt-10 max-w-md">
              <motion.div {...rise(0.45)} className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold text-white/80">
                    <ChartColumn className="h-3.5 w-3.5 text-brand-300" /> Follower growth
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">Preview</span>
                </div>
                <svg viewBox="0 0 120 40" fill="none" aria-hidden className="mt-3 h-14 w-full">
                  <defs>
                    <linearGradient id="tagSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f15d27" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#f15d27" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <motion.path d={`${SPARK_LINE} L118 40 L2 40 Z`} fill="url(#tagSpark)"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.0, duration: 0.5 }} />
                  <motion.path d={SPARK_LINE} stroke="#f78154" strokeWidth="2.5" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 1.3, ease: 'easeOut' }} />
                </svg>
                <p className="mt-2 text-[11px] font-medium text-white/55">All four platforms · last 30 days</p>
              </motion.div>

              <motion.div {...rise(0.6)} className="absolute -bottom-6 -right-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0d1e3d]/90 p-3.5 pr-4 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:-right-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/20">
                  <ImageIcon className="h-4 w-4 text-brand-300" />
                </span>
                <span className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">Tech fest poster</p>
                  <p className="text-[11px] text-white/55">NCET · Instagram</p>
                </span>
                <StatusFlip />
              </motion.div>
            </div>
          </motion.div>

          <motion.div {...rise(0.35)} className="relative z-10 flex items-center border-t border-white/10 pt-6">
            <div className="flex items-center gap-2.5">
              {PLATFORMS.map(({ icon: Icon, name }) => (
                <span key={name} title={name} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] backdrop-blur-md">
                  <Icon aria-label={name} className="h-[18px] w-[18px] text-white/80" />
                </span>
              ))}
            </div>
            <div className="ml-4">
              <p className="text-sm font-semibold text-white">One dashboard, four platforms</p>
              <p className="mt-0.5 text-xs text-white/55">LinkedIn · Instagram · Facebook · YouTube</p>
            </div>
          </motion.div>
        </div>

        {/* Right form side */}
        <div className="relative flex w-full items-center justify-center overflow-hidden p-6 sm:p-10 lg:w-1/2">
          <div aria-hidden className="pointer-events-none absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-brand-500/[0.07] blur-3xl dark:bg-brand-500/[0.12]" />
          <div aria-hidden className="login-dots pointer-events-none absolute inset-x-0 top-0 h-48 lg:hidden" />

          <div className="w-full max-w-md">
            {/* Brand header for mobile, where the panel is hidden */}
            <div className="mb-8 flex flex-col items-center gap-2.5 lg:hidden">
              <img src="/logo-trim.png" alt="t@g" className="h-12 w-auto dark:hidden" />
              <img src="/logo-light.png" alt="t@g" className="hidden h-12 w-auto dark:block" />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Campus Marketing Hub</p>
            </div>

            {/* Glass card with the living conic border (.login-card::before) */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="login-card relative w-full rounded-3xl bg-white/85 p-6 shadow-[0_24px_60px_-24px_rgba(11,35,80,0.25)] backdrop-blur-xl dark:bg-slate-900/75 dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] sm:p-10"
            >
              <motion.div {...itemAt(0.25)} className="mb-8">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-700 dark:text-brand-400">
                  <Sparkles className="h-3.5 w-3.5" /> Sign in
                </p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">{greeting}.</h2>
                <div aria-hidden className="mt-4 h-px w-full bg-slate-200 dark:bg-slate-700"><div className="h-px w-10 bg-brand-500" /></div>
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Pick up right where you left off — your dashboards are waiting.</p>
              </motion.div>

              <form onSubmit={submit} className="space-y-4">
                <motion.div {...itemAt(0.32)} className="group relative">
                  <Mail className="pointer-events-none absolute left-3 top-[35px] h-4 w-4 text-slate-400 transition-colors duration-200 group-focus-within:text-brand-500" />
                  <Input label="Email" labelClassName={LABEL_CLS} type="email" required autoFocus autoComplete="email"
                    placeholder="you@dmm.com" className="login-input pl-9"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </motion.div>
                <motion.div {...itemAt(0.39)} className="group relative">
                  <Lock className="pointer-events-none absolute left-3 top-[35px] h-4 w-4 text-slate-400 transition-colors duration-200 group-focus-within:text-brand-500" />
                  <Input label="Password" labelClassName={LABEL_CLS} type="password" required autoComplete="current-password"
                    placeholder="••••••••" className="login-input pl-9"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </motion.div>
                <motion.div {...itemAt(0.46)} className="flex justify-end">
                  <Link to="/forgot-password"
                    className="relative text-sm font-medium text-brand-700 after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-brand-700 after:transition-[width] after:duration-200 hover:text-brand-800 hover:after:w-full dark:text-brand-400 dark:hover:text-brand-300">
                    Forgot password?
                  </Link>
                </motion.div>
                <motion.div {...itemAt(0.53)}>
                  <Button type="submit" loading={loading} size="lg" className="group relative w-full overflow-hidden">
                    <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:animate-[tag-sheen_0.9s_ease-out]" />
                    Sign in <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Button>
                </motion.div>
              </form>

              <motion.p {...itemAt(0.6)} className="mt-8 text-center text-sm">
                <span className="font-medium text-brand-700 dark:text-brand-400">New to t@g?</span>{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">Ask your administrator for access.</span>
              </motion.p>
            </motion.div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
