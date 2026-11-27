/**
 * "Full for these dates" → the closest stays of the same length that do have space.
 * Pure (browser-safe): the live engine and the enquiry-mode search both use it.
 */
import { addDays, daysBetween, type IsoDate } from './dates';
import type { Paise } from './money';

export interface OpenStay { checkIn: IsoDate; checkOut: IsoDate; fromRate: Paise }

/** Days looked at before and after the asked-for check-in. */
export const LOOK_BACK_DAYS = 7;
export const LOOK_AHEAD_DAYS = 14;

/**
 * Same number of nights, check-in moved by up to a week earlier or two weeks later, never in the
 * past or beyond the booking window. Closest first; on a tie the later date wins (guests more
 * often can come later than earlier). `openFrom(checkIn, checkOut)` gives the lowest nightly rate
 * among room types with space on every night, or null when nothing fits.
 */
export function nearestOpenStays(
  checkIn: IsoDate, nights: number, today: IsoDate, windowDays: number,
  openFrom: (checkIn: IsoDate, checkOut: IsoDate) => Paise | null, max = 3,
): OpenStay[] {
  const offsets: number[] = [];
  for (let k = 1; k <= Math.max(LOOK_BACK_DAYS, LOOK_AHEAD_DAYS); k++) {
    if (k <= LOOK_AHEAD_DAYS) offsets.push(k);
    if (k <= LOOK_BACK_DAYS) offsets.push(-k);
  }
  const out: OpenStay[] = [];
  for (const k of offsets) {
    const ci = addDays(checkIn, k);
    const ahead = daysBetween(today, ci);
    if (ahead < 0 || ahead > windowDays) continue;
    const co = addDays(ci, nights);
    const rate = openFrom(ci, co);
    if (rate !== null) out.push({ checkIn: ci, checkOut: co, fromRate: rate });
    if (out.length >= max) break;
  }
  return out;
}

/** The nights a suggestion search needs counts for (inclusive start, exclusive end). */
export function suggestionRange(checkIn: IsoDate, nights: number, today: IsoDate): { from: IsoDate; to: IsoDate } {
  const back = addDays(checkIn, -LOOK_BACK_DAYS);
  return { from: daysBetween(today, back) < 0 ? today : back, to: addDays(checkIn, LOOK_AHEAD_DAYS + nights) };
}
