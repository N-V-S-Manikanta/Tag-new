import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const formatDate = (d) => (d ? format(new Date(d), 'dd MMM yyyy') : '-');
export const formatDateTime = (d) => (d ? format(new Date(d), 'dd MMM yyyy, HH:mm') : '-');
export const timeAgo = (d) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '-');

export const formatNumber = (n) => {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
};

export const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const ROLE_STYLES = {
  ADMIN: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  CEO: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  USER: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
};
