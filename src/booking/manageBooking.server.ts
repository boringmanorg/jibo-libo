/**
 * "Manage my booking" (/book/manage): a guest opens their booking with its reference and the phone
 * number they booked with, sees what is paid and what is due, pays the balance through a payment
 * link, and asks for the one date change the policy allows. Server only.
 *
 * - Nothing is shown unless the reference AND the phone match. Failed attempts are throttled per
 *   visitor and per booking, and the answer never says which of the two was wrong.
 * - A date change is a request: the desk applies it from the console with the existing date-change
 *   action (which checks the policy and the price again) or declines it.
 */
import { createHash } from 'node:crypto';
import { findRoomType } from './catalogue';
import { addDays, daysBetween, todayInIndia, type IsoDate } from './dates';
import { canChangeDates, lastChangeDate, type BookingStatus } from './policy';
import { HOSTEL_POLICIES } from '@/data/hostelPolicies';
import type { Paise } from './money';
import { EngineError, gatewayOf, searchStays, settleLink, validateDates, type EngineDeps } from './publicEngine.core';

/** Failed lookups allowed per visitor per hour, and per booking reference per hour. */
export const FAILS_PER_VISITOR_HOUR = 8;
export const FAILS_PER_BOOKING_HOUR = 5;

const NOT_FOUND = 'We couldn’t find a booking with that reference and phone number. Check both and try again.';
const LOCKED = 'Too many tries. Please wait an hour, or message the desk on WhatsApp with your reference.';

export const digits = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');
/** Same number whatever the format: the last 10 digits must match (+91 98…, 098…, 98…). */
export function phoneMatches(stored: string | null | undefined, given: string | null | undefined): boolean {
  const a = digits(stored), b = digits(given);
  return a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10);
}

const visitorHash = (ip: string | undefined, now: Date) =>
  createHash('sha256').update(`manage|${ip ?? 'unknown'}|${now.toISOString().slice(0, 10)}|${process.env['ENQUIRY_HASH_SALT'] ?? 'xtsy-inbox'}`).digest('hex').slice(0, 32);

export interface ManagedBooking {
  reference: string;
  status: 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'awaiting_payment';
  firstName: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  rooms: { name: string; units: number; unit: 'bed' | 'room' }[];
  total: Paise;
  paid: Paise;
  due: Paise;
  /** The guest can pay the balance online now. */
  canPay: boolean;
  dateChange: { allowed: boolean; reason?: string; lastDate: IsoDate | null };
  request: { checkIn: IsoDate; checkOut: IsoDate; status: 'pending' | 'applied' | 'declined'; reason?: string | null } | null;
}

type Db = NonNullable<EngineDeps['db']>;

/** Checks reference + phone (throttled) and returns the booking row, or throws a guest-safe message. */
async function open(d: EngineDeps, reference: string, phone: string, ip: string | undefined) {
  if (!d.db) throw new EngineError('Bookings can’t be looked up right now. Please message the desk on WhatsApp.');
  const db: Db = d.db;
  const ref = reference.trim().toUpperCase();
  const visitor = visitorHash(ip, d.now);
  const since = new Date(d.now.getTime() - 3600_000).toISOString();
  const [byVisitor, byBooking] = await Promise.all([
    db.from('be_guest_lookups').select('id', { count: 'exact', head: true }).eq('visitor_hash', visitor).eq('ok', false).gte('created_at', since),
    db.from('be_guest_lookups').select('id', { count: 'exact', head: true }).eq('reference', ref).eq('ok', false).gte('created_at', since),
  ]);
  if (byVisitor.error || byBooking.error) throw new EngineError('Bookings can’t be looked up right now. Please message the desk on WhatsApp.');
  if ((byVisitor.count ?? 0) >= FAILS_PER_VISITOR_HOUR || (byBooking.count ?? 0) >= FAILS_PER_BOOKING_HOUR) throw new EngineError(LOCKED);
  const b = /^XTSY-[A-Z0-9]{5,6}$/.test(ref)
    ? await db.from('be_bookings').select('id,reference,status,check_in,check_out,guest_name,guest_phone,total_paise,advance_paise,balance_paise,date_changes_used,be_booking_lines(room_type_id,units,guests)').eq('reference', ref).maybeSingle()
    : { data: null };
  const ok = !!b.data && phoneMatches(b.data.guest_phone, phone);
  await db.from('be_guest_lookups').insert({ visitor_hash: visitor, reference: ref.slice(0, 20), ok });
  if (!ok) throw new EngineError(NOT_FOUND);
  return { db, booking: b.data as any };
}

async function payments(db: Db, bookingId: string) {
  const p = await db.from('be_payments').select('id,kind,status,amount_paise,link_id,link_url,created_at').eq('booking_id', bookingId).order('created_at');
  return (p.data ?? []) as { id: string; kind: string; status: string; amount_paise: number; link_id: string | null; link_url: string | null }[];
}

const paidOf = (ps: { kind: string; status: string; amount_paise: number }[]) =>
  ps.filter((p) => p.status === 'succeeded' && p.kind !== 'refund').reduce((s, p) => s + Number(p.amount_paise), 0);

function statusOf(s: string): ManagedBooking['status'] {
  if (s === 'confirmed') return 'confirmed';
  if (s === 'checked_in') return 'checked_in';
  if (s === 'settled') return 'completed';
  if (s.startsWith('cancelled')) return 'cancelled';
  return 'awaiting_payment';
}

async function view(d: EngineDeps, db: Db, b: any): Promise<ManagedBooking> {
  let ps = await payments(db, b.id);
  // A balance link paid while a webhook was missed: re-read open links before showing the balance.
  const open = ps.filter((p) => p.kind === 'balance' && p.status === 'created' && p.link_id);
  if (open.length) {
    for (const p of open) await settleLink(d, p.link_id!);
    ps = await payments(db, b.id);
  }
  const paid = paidOf(ps);
  const due = Math.max(0, Number(b.total_paise) - paid);
  const status = statusOf(b.status);
  const policy = { status: b.status as BookingStatus, checkIn: b.check_in, dateChangesUsed: Number(b.date_changes_used ?? 0) };
  const change = canChangeDates(policy, d.now);
  const req = await db.from('be_change_requests').select('check_in,check_out,status,decided_reason,created_at').eq('booking_id', b.id).order('created_at', { ascending: false }).limit(1);
  const last = (req.data ?? [])[0];
  return {
    reference: b.reference, status, firstName: String(b.guest_name ?? '').trim().split(/\s+/)[0] ?? '',
    checkIn: b.check_in, checkOut: b.check_out, nights: daysBetween(b.check_in, b.check_out),
    rooms: (b.be_booking_lines ?? []).map((l: any) => {
      const room = findRoomType(l.room_type_id);
      return { name: room?.name ?? l.room_type_id, units: Number(l.units), unit: room?.soldAs ?? 'room' };
    }),
    total: Number(b.total_paise), paid, due,
    canPay: due > 0 && (status === 'confirmed' || status === 'checked_in') && gatewayOf(d) !== null,
    dateChange: change.allowed
      ? { allowed: !(last && last.status === 'pending'), reason: last?.status === 'pending' ? 'Your date change request is with the desk.' : undefined, lastDate: lastChangeDate(policy, d.now) }
      : { allowed: false, reason: change.reason, lastDate: null },
    request: last ? { checkIn: last.check_in, checkOut: last.check_out, status: last.status, reason: last.decided_reason } : null,
  };
}

export async function manageLookup(d: EngineDeps, reference: string, phone: string, ip?: string): Promise<ManagedBooking> {
  const { db, booking } = await open(d, reference, phone, ip);
  return view(d, db, booking);
}

/**
 * A payment link for everything still due. An open link for the same amount is reused, so pressing
 * the button twice never creates two links. Paid through the link, it shows here and in the console.
 */
export async function payBalance(d: EngineDeps, reference: string, phone: string, ip?: string): Promise<{ url: string; amount: Paise }> {
  const { db, booking } = await open(d, reference, phone, ip);
  const v = await view(d, db, booking);
  if (!v.canPay) throw new EngineError(v.due <= 0 ? 'Nothing is due on this booking.' : 'Online payment isn’t available for this booking. Please pay at the desk.');
  const ps = await payments(db, booking.id);
  const reuse = ps.find((p) => p.kind === 'balance' && p.status === 'created' && p.link_url && Number(p.amount_paise) === v.due);
  if (reuse) return { url: reuse.link_url!, amount: v.due };
  const gateway = gatewayOf(d)!;
  const today = todayInIndia(d.now);
  const link = await gateway.createPaymentLink({
    reference: booking.reference, amount: v.due, description: `Balance for ${booking.reference}`,
    expiresOn: daysBetween(today, booking.check_out) > 0 ? booking.check_out : addDays(today, 1),
  });
  await db.from('be_payments').insert({ booking_id: booking.id, kind: 'balance', gateway: gateway.id, link_id: link.linkId, link_url: link.url, amount_paise: v.due, status: 'created' });
  await db.from('be_audit_log').insert({ action: 'payment.balance_link.guest', details: { reference: booking.reference, due: v.due } });
  return { url: link.url, amount: v.due };
}

/**
 * The guest's one date change, as a request for the desk. Checked now against the policy
 * (confirmed, unused, at least 14 days ahead) and against availability for the booked rooms.
 */
export async function requestDateChange(d: EngineDeps, reference: string, phone: string, ip: string | undefined, checkIn: string, checkOut: string, note?: string): Promise<ManagedBooking> {
  const { db, booking } = await open(d, reference, phone, ip);
  const v = await view(d, db, booking);
  if (!v.dateChange.allowed) throw new EngineError(v.dateChange.reason ?? 'This booking can’t change dates online.');
  const dates = validateDates(checkIn, checkOut, d.now);
  if (dates.checkIn === booking.check_in && dates.checkOut === booking.check_out) throw new EngineError('Those are your current dates.');
  if (daysBetween(todayInIndia(d.now), dates.checkIn) < HOSTEL_POLICIES.modificationCutoffDays) {
    throw new EngineError(`New dates must also start at least ${HOSTEL_POLICIES.modificationCutoffDays} days from today.`);
  }
  // New dates that do not overlap the booking are checked here. Overlapping ones would count the
  // guest's own beds as taken, so the desk checks those when applying the change.
  const overlaps = dates.checkIn < booking.check_out && booking.check_in < dates.checkOut;
  if (!overlaps) {
    const found = await searchStays(d, dates);
    const short = (booking.be_booking_lines ?? []).filter((l: any) => (found.rooms.find((r) => r.id === l.room_type_id)?.freeForStay ?? 0) < Number(l.units));
    if (short.length) throw new EngineError('Your rooms aren’t free on those dates. Try other dates.');
  }
  const ins = await db.from('be_change_requests').insert({ booking_id: booking.id, check_in: dates.checkIn, check_out: dates.checkOut, note: note?.trim().slice(0, 300) || null });
  if (ins.error) throw new EngineError(ins.error.code === '23505' ? 'Your date change request is already with the desk.' : 'Could not send the request. Please try again.');
  await db.from('be_audit_log').insert({ action: 'booking.date_change_requested', details: { reference: booking.reference, from: [booking.check_in, booking.check_out], to: [dates.checkIn, dates.checkOut] } });
  return view(d, db, booking);
}
