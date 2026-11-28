import { daysOf, inRange } from './dateRange';

export interface InsightArrival {
  propertyId: string; checkInDate: string; checkOutDate: string; totalGuests: number;
  isInternational?: boolean; referralSource?: string; purpose?: string; state?: string; country?: string;
}
export interface Tally { label: string; count: number }

const nightsBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000));

function tally(values: string[], top = 6): Tally[] {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, top);
}

/** Arrival insights for a date range: counts are by check-in date; guest-nights use the guest's check-out. */
export function summarizeArrivals(rows: InsightArrival[], range: { from: string; to: string }) {
  const list = rows.filter((r) => inRange(r.checkInDate, range));
  const guests = list.reduce((n, r) => n + r.totalGuests, 0);
  const stays = list.filter((r) => r.checkOutDate && r.checkOutDate > r.checkInDate);
  const guestNights = stays.reduce((n, r) => n + nightsBetween(r.checkInDate, r.checkOutDate) * r.totalGuests, 0);
  const avgNights = stays.length ? stays.reduce((n, r) => n + nightsBetween(r.checkInDate, r.checkOutDate), 0) / stays.length : 0;
  const intl = list.filter((r) => r.isInternational).length;
  return {
    checkIns: list.length,
    guests,
    guestNights,
    avgNights: Math.round(avgNights * 10) / 10,
    internationalPct: list.length ? Math.round((intl / list.length) * 100) : 0,
    sources: tally(list.map((r) => r.referralSource ?? '')),
    origins: tally(list.map((r) => (r.country && r.country.toLowerCase() !== 'india' ? r.country : r.state ?? '').trim())),
    purposes: tally(list.map((r) => r.purpose ?? '')),
    perDay: daysOf(range).map((day) => { const d = list.filter((r) => r.checkInDate === day); return { day, checkIns: d.length, guests: d.reduce((n, r) => n + r.totalGuests, 0) }; }),
  };
}
