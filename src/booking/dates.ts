/** Stay dates are ISO calendar dates (YYYY-MM-DD) in India time; nothing here depends on the server's clock zone. */
export type IsoDate = string;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value;
}

const toDay = (d: IsoDate): number => Date.parse(`${d}T00:00:00Z`) / DAY_MS;
const fromDay = (n: number): IsoDate => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: IsoDate, to: IsoDate): number => toDay(to) - toDay(from);

/** Today's date in India for a given instant. */
export const todayInIndia = (now: Date): IsoDate => new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** The nights of a stay: check-in up to, not including, check-out. */
export function stayNights(checkIn: IsoDate, checkOut: IsoDate): IsoDate[] {
  const n = daysBetween(checkIn, checkOut);
  return Array.from({ length: Math.max(0, n) }, (_, i) => fromDay(toDay(checkIn) + i));
}

/** The date `n` days after `d` (negative goes back). */
export const addDays = (d: IsoDate, n: number): IsoDate => fromDay(toDay(d) + n);
