import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const formatDate = (d) => (d ? format(new Date(d), 'dd MMM yyyy') : '-');
export const formatDateTime = (d) => (d ? format(new Date(d), 'dd MMM yyyy, HH:mm') : '-');
export const timeAgo = (d) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '-');

// Show the full count with thousands separators (e.g. 12,400) — no K/M shorthand.
export const formatNumber = (n) => {
  if (n == null || n === '') return '0';
  const num = Number(n);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-US');
};

export const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Trigger a browser download for a Blob (e.g. an Excel file returned by the API).
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Is this approval media item a video? Checks stored mediaType or URL extension.
export const isVideo = (m) =>
  m?.mediaType === 'video' || /\.(mp4|webm|mov|m4v|ogg|mkv)$/i.test(m?.url || '');

export const ROLE_STYLES = {
  ADMIN: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  CEO: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  USER: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
};

// Three tiers shown to people: Super Admin → Admin (org manager, stored as CEO)
// → User. The internal role enum stays ADMIN/CEO/USER.
export const roleLabel = (u) => (u?.isSuperAdmin ? 'Super Admin' : u?.role === 'USER' ? 'User' : 'Admin');
export const roleStyle = (u) =>
  u?.isSuperAdmin
    ? ROLE_STYLES.ADMIN
    : u?.role === 'USER'
      ? ROLE_STYLES.USER
      : ROLE_STYLES.CEO;
