import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/primitives.jsx';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

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
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 p-12 text-white lg:flex">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <span className="text-xl font-extrabold">M</span>
          </div>
          <span className="text-lg font-bold">DMM Platform</span>
        </div>
        <div className="relative">
          <Sparkles className="mb-5 h-10 w-10 text-brand-200" />
          <h1 className="text-4xl font-extrabold leading-tight">Manage your entire digital marketing in one place.</h1>
          <p className="mt-4 max-w-md text-brand-100">
            Analytics, content approvals, templates and assets — built for marketing teams and management.
          </p>
        </div>
        <div className="relative flex gap-8 text-sm text-brand-100">
          <div><p className="text-2xl font-bold text-white">4+</p>Platforms</div>
          <div><p className="text-2xl font-bold text-white">5</p>Workflow stages</div>
          <div><p className="text-2xl font-bold text-white">∞</p>Possibilities</div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white">Sign in</h2>
            <p className="mt-2 text-sm text-slate-400">Welcome back! Please enter your details.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
              <Input label="Email" type="email" required placeholder="you@dmm.com" className="pl-9"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
              <Input label="Password" type="password" required placeholder="••••••••" className="pl-9"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">Forgot password?</Link>
            </div>
            <Button type="submit" loading={loading} size="lg" className="w-full">
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Don't have an account? Contact your administrator to get access.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
