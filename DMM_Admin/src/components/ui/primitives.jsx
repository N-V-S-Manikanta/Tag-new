import { cn, initials } from '../../lib/utils.js';

export function Card({ className, children, ...props }) {
  return <div className={cn('card', className)} {...props}>{children}</div>;
}

export function Input({ className, label, error, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>}
      <input className={cn('input-base', error && 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/10', className)} {...props} />
      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
    </label>
  );
}

export function Select({ className, label, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>}
      <select className={cn('input-base cursor-pointer', className)} {...props}>{children}</select>
    </label>
  );
}

export function Badge({ children, className }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
      className || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
      {children}
    </span>
  );
}

export function Avatar({ src, name = '', size = 'md', className }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base' };
  return src ? (
    <img src={src} alt={name} className={cn('rounded-full object-cover ring-2 ring-white dark:ring-slate-800', sizes[size], className)} />
  ) : (
    <div className={cn('flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200', sizes[size], className)}>
      {initials(name)}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800', className)} />;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-16 text-center">
      {Icon && <div className="mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 p-4"><Icon className="h-7 w-7 text-slate-400" /></div>}
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
