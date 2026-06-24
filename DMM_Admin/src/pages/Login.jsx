import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuthStore, NotAdminError } from '../store/authStore.js';
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
      toast.success(`Welcome, ${user.name.split(' ')[0]}`);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof NotAdminError) toast.error(err.message);
      else toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-violet-900 p-12 text-white lg:flex">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><ShieldCheck className="h-6 w-6" /></div>
          <span className="text-lg font-bold">DMM Admin</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">Platform administration console.</h1>
          <p className="mt-4 max-w-md text-brand-100">Manage users, roles, access and social analytics for your marketing platform — all in one secure place.</p>
        </div>
        <p className="relative text-sm text-brand-200">Administrator access only.</p>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white">Admin sign in</h2>
            <p className="mt-2 text-sm text-slate-400">Sign in with your administrator account.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
              <Input label="Email" type="email" required placeholder="admin@yourcompany.com" className="pl-9"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
              <Input label="Password" type="password" required placeholder="••••••••" className="pl-9"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <Button type="submit" loading={loading} size="lg" className="w-full">Sign in <ArrowRight className="h-4 w-4" /></Button>
          </form>
          <p className="mt-8 text-center text-xs text-slate-400">Non-admin users should use the main platform app.</p>
        </motion.div>
      </div>
    </div>
  );
}
