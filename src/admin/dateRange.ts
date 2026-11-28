/** Console date ranges: shared presets for check-ins, bookings, inventory and Today. Dates are India-local YYYY-MM-DD. */
export const RANGE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: 'next7', label: 'Next 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'custom', label: 'Custom range' },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]['id'];
export interface DateRange { preset: RangePreset; from: string; to: string; label: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const addDaysIso = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const todayInIndiaIso = (now = new Date()) => new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

export function resolveRange(preset: string | undefined, from: string | undefined, to: string | undefined, today: string, fallback: RangePreset = 'today'): DateRange {
  const p = (RANGE_PRESETS.some((r) => r.id === preset) ? preset : fallback) as RangePreset;
  const label = RANGE_PRESETS.find((r) => r.id === p)!.label;
  switch (p) {
    case 'yesterday': { const y = addDaysIso(today, -1); return { preset: p, from: y, to: y, label }; }
    case '7d': return { preset: p, from: addDaysIso(today, -6), to: today, label };
    case 'next7': return { preset: p, from: today, to: addDaysIso(today, 6), label };
    case '30d': return { preset: p, from: addDaysIso(today, -29), to: today, label };
    case 'custom': {
      let a = from && ISO.test(from) ? from : today;
      let b = to && ISO.test(to) ? to : a;
      if (b < a) [a, b] = [b, a];
      // Cap custom ranges at 92 days so lists and inventory reads stay small.
      if (addDaysIso(a, 91) < b) b = addDaysIso(a, 91);
      return { preset: p, from: a, to: b, label: a === b ? a : `${a} → ${b}` };
    }
    default: return { preset: 'today', from: today, to: today, label: 'Today' };
  }
}

export const inRange = (iso: string | null | undefined, r: { from: string; to: string }) => !!iso && iso.slice(0, 10) >= r.from && iso.slice(0, 10) <= r.to;

export function daysOf(r: { from: string; to: string }): string[] {
  const out: string[] = [];
  for (let d = r.from; d <= r.to && out.length < 93; d = addDaysIso(d, 1)) out.push(d);
  return out;
}

/** Group items into day buckets, newest day first, keeping empty days out. */
export function groupByDay<T>(items: T[], day: (t: T) => string): { day: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const it of items) { const d = day(it).slice(0, 10); map.set(d, [...(map.get(d) ?? []), it]); }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([d, list]) => ({ day: d, items: list }));
}

const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export function dayHeading(iso: string, today: string): string {
  if (iso === today) return `Today · ${dayFmt.format(new Date(`${iso}T00:00:00Z`))}`;
  if (iso === addDaysIso(today, -1)) return `Yesterday · ${dayFmt.format(new Date(`${iso}T00:00:00Z`))}`;
  if (iso === addDaysIso(today, 1)) return `Tomorrow · ${dayFmt.format(new Date(`${iso}T00:00:00Z`))}`;
  return dayFmt.format(new Date(`${iso}T00:00:00Z`));
}
