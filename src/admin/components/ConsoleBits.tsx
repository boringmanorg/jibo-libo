/** Shared pieces for the console's redesigned screens (XTSY light brand). */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="xt-display text-5xl leading-[0.9] text-xt-ink sm:text-6xl">{title}</h1>
        {sub && <div className="mt-2 text-[15px] text-xt-mute">{sub}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[24px] border border-xt-line bg-white p-5 sm:p-6', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-extrabold text-xt-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const a = Math.abs(s);
  if (a < 45) return 'just now';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

export function SheetChip({ syncedAt }: { syncedAt: string | null }) {
  const fresh = syncedAt && Date.now() - new Date(syncedAt).getTime() < 20 * 60_000;
  return (
    <span className={cn('inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold',
      !syncedAt ? 'border-xt-line bg-xt-cream text-xt-mute' : fresh ? 'border-xt-leaf/30 bg-xt-leaf/10 text-xt-pine' : 'border-amber-300 bg-amber-50 text-amber-900')}>
      <span className={cn('h-2 w-2 rounded-full', !syncedAt ? 'bg-xt-stone' : fresh ? 'bg-xt-leaf' : 'bg-amber-500')} aria-hidden />
      {!syncedAt ? 'Google Sheet not connected' : `Sheet synced ${ago(syncedAt)}`}
    </span>
  );
}

export const STATUS_STYLE: Record<string, string> = {
  new: 'bg-xt-crimson text-white',
  contacted: 'bg-xt-cream text-xt-ink',
  confirmed: 'bg-xt-leaf/15 text-xt-pine',
  lost: 'bg-xt-oat text-xt-mute',
};
export const STATUS_LABEL: Record<string, string> = { new: 'New', contacted: 'Contacted', confirmed: 'Confirmed', lost: 'Lost' };

export const inrWhole = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const dm = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const wd = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' });
export const dayMonth = (iso: string) => dm.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
export const weekday = (iso: string) => wd.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/** Colour for a free count: full, nearly full, open. */
export function freeTone(free: number, total: number) {
  if (free <= 0) return 'bg-xt-blush text-xt-crimson-dark';
  if (free <= Math.max(1, Math.floor(total / 4))) return 'bg-amber-50 text-amber-900';
  return 'bg-xt-leaf/10 text-xt-pine';
}
