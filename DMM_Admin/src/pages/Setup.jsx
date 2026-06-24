import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ShieldCheck, User, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/primitives.jsx';

// First-run: create the very first administrator account.
export default function Setup({ onDone }) {
  const navigate = useNavigate();
  const setup = useAuthStore((s) => s.setup);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await setup({ name: form.name, email: form.email, password: form.password });
      toast.success('Admin account created. Welcome!');
      onDone?.();
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Setup failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">Set up the platform</h1>
          <p className="mt-2 text-sm text-slate-400">Create the administrator account. This is a one-time step.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-card">
          <Field icon={User} label="Full name" type="text" placeholder="e.g. Jane Doe" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field icon={Mail} label="Email" type="email" placeholder="admin@yourcompany.com" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field icon={Lock} label="Password" type="password" placeholder="At least 6 characters" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <Field icon={Lock} label="Confirm password" type="password" placeholder="Re-enter password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
          <Button type="submit" loading={loading} size="lg" className="w-full">Create admin account <ArrowRight className="h-4 w-4" /></Button>
        </form>
      </motion.div>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, ...props }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
      <Input label={label} required className="pl-9" value={value} onChange={(e) => onChange(e.target.value)} {...props} />
    </div>
  );
}
