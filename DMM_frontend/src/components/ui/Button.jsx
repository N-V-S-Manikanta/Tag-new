import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-4 active:scale-[0.98] whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-soft focus:ring-brand-500/20',
        secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700',
        outline: 'border border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200',
        ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300',
        danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-soft focus:ring-rose-500/20',
        success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-soft focus:ring-emerald-500/20',
      },
      size: {
        sm: 'h-9 px-3.5 text-xs',
        md: 'h-11 px-5',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export function Button({ className, variant, size, loading, children, disabled, ...props }) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
