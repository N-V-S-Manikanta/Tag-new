import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn, formatNumber } from '../../lib/utils.js';

// Pass `to` to make the card clickable — it navigates to that route.
export default function StatCard({ label, value, icon: Icon, tone = 'brand', delay = 0, suffix, to }) {
  const navigate = useNavigate();
  const tones = {
    brand: 'from-brand-500 to-brand-700 text-brand-600 bg-brand-50 dark:bg-brand-500/10',
    emerald: 'from-emerald-500 to-emerald-700 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
    amber: 'from-amber-500 to-amber-600 text-amber-600 bg-amber-50 dark:bg-amber-500/10',
    rose: 'from-rose-500 to-rose-700 text-rose-600 bg-rose-50 dark:bg-rose-500/10',
    violet: 'from-violet-500 to-violet-700 text-violet-600 bg-violet-50 dark:bg-violet-500/10',
    sky: 'from-sky-500 to-sky-700 text-sky-600 bg-sky-50 dark:bg-sky-500/10',
  };
  const [, iconColor, iconBg, iconBgDark] = tones[tone].split(' ');
  const clickable = !!to;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      onClick={clickable ? () => navigate(to) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(to); } } : undefined}
      className={cn('card p-5', clickable && 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-brand-500/40')}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            {typeof value === 'number' ? formatNumber(value) : value}{suffix}
          </p>
        </div>
        {Icon && (
          <div className={cn('rounded-xl p-2.5', iconBg, iconBgDark)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
