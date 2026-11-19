/**
 * Booking policy, owner-approved 19 Nov 2026. The engine enforces these rules; the website
 * wording lives in src/data/hostelPolicies.ts and both read the same numbers.
 */
import { HOSTEL_POLICIES } from '@/data/hostelPolicies';
import { daysBetween, todayInIndia, type IsoDate } from './dates';
import { applyBps, type Paise } from './money';

export type BookingStatus = 'held' | 'confirmed' | 'checked_in' | 'settled' | 'cancelled_by_guest' | 'cancelled_by_xtsy' | 'expired';

export interface PolicyBooking {
  status: BookingStatus;
  checkIn: IsoDate;
  dateChangesUsed: number;
}

export type Decision = { allowed: true } | { allowed: false; reason: string };

const CUTOFF = HOSTEL_POLICIES.modificationCutoffDays;

/** One change per booking, requested at least 14 days before check-in. */
export function canChangeDates(b: PolicyBooking, now: Date): Decision {
  if (b.status !== 'confirmed') return { allowed: false, reason: 'Only confirmed bookings can change dates.' };
  if (b.dateChangesUsed >= HOSTEL_POLICIES.modificationsAllowed) return { allowed: false, reason: 'This booking has already used its one date change.' };
  const daysLeft = daysBetween(todayInIndia(now), b.checkIn);
  if (daysLeft < CUTOFF) return { allowed: false, reason: `Dates can only be changed at least ${CUTOFF} days before check-in.` };
  return { allowed: true };
}

/** The last date a guest can still ask for a change, or null if the window has closed. */
export function lastChangeDate(b: PolicyBooking, now: Date): IsoDate | null {
  const d = new Date(Date.parse(`${b.checkIn}T00:00:00Z`) - CUTOFF * 86_400_000).toISOString().slice(0, 10);
  return daysBetween(todayInIndia(now), d) >= 0 && b.dateChangesUsed < HOSTEL_POLICIES.modificationsAllowed ? d : null;
}

/** Guest cancellations are never refunded. XTSY-side cancellations refund everything paid. */
export function refundOnCancel(by: 'guest' | 'xtsy', amountPaid: Paise): Paise {
  return by === 'guest' ? 0 : amountPaid;
}

/** 25% advance confirms; 75% at check-in. The two parts always add up to the total exactly. */
export function splitPayment(total: Paise): { advance: Paise; balance: Paise } {
  const advance = applyBps(total, HOSTEL_POLICIES.advancePercent * 100);
  return { advance, balance: total - advance };
}
