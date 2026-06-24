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

export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Status -> tailwind color classes (badges, dots)
export const STATUS_STYLES = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  RESUBMITTED: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  POSTED: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
};

export const PLATFORM_STYLES = {
  LinkedIn: { color: '#0A66C2', bg: 'bg-[#0A66C2]' },
  Instagram: { color: '#E1306C', bg: 'bg-[#E1306C]' },
  YouTube: { color: '#FF0000', bg: 'bg-[#FF0000]' },
  Facebook: { color: '#1877F2', bg: 'bg-[#1877F2]' },
};

export const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
