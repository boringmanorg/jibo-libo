/**
 * Booking-engine console logic. Every function takes the admin's database client (row-level
 * security limits it to admin@xtsy.one) and the server environment. When the be_ tables do not
 * exist yet, functions report `dbReady: false` instead of failing.
 */
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { unmappedRoomTypes, type ChannelManager, type ChannelMapping } from '@/booking/channel/channelManager';
import { staahNotConnected } from '@/booking/channel/staah.server';
import { addDays, stayNights, todayInIndia, type IsoDate } from '@/booking/dates';
import { launchBlockers } from '@/booking/launchGate';
import { botCheckConfigured } from '@/booking/botCheck';
import { canChangeDates, refundOnCancel, type BookingStatus } from '@/booking/policy';
import { quoteStay } from '@/booking/pricing';
import { nightAudit, type AuditBooking, type AuditPayment } from '@/booking/reconcile';
import { reviewSettings, settingsFromRow, type SettingsInput } from '@/booking/consoleSettings';
import { validateFeeTable, type FeeTable, type PaymentMethod } from '@/booking/payments/fees';
import type { PaymentGateway } from '@/booking/payments/gateway';
import { createZohoGateway, zohoConfigFromEnv } from '@/booking/payments/zoho.server';

type Db = any;
export interface ConsoleDeps {
  db: Db;
  env: Record<string, string | undefined>;
  now: Date;
  channel?: ChannelManager;
  gateway?: PaymentGateway | null;
}

export class ConsoleError extends Error {}

/** True for "table or function does not exist" from Postgres or the Supabase API. */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ['42P01', '42883', 'PGRST205', 'PGRST202'].includes(error.code ?? '') || /does not exist|could not find the (table|function)/i.test(error.message ?? '');
}

const channelOf = (d: ConsoleDeps) => d.channel ?? staahNotConnected();
const gatewayOf = (d: ConsoleDeps): PaymentGateway | null => {
  if (d.gateway !== undefined) return d.gateway;
  const cfg = zohoConfigFromEnv(d.env);
  return cfg ? createZohoGateway(cfg) : null;
};

async function audit(d: ConsoleDeps, action: string, details: Record<string, unknown>) {
  await d.db.from('be_audit_log').insert({ action, details });
}

export async function loadStatus(d: ConsoleDeps) {
  const s = await d.db.from('be_settings').select('*').eq('id', 1).maybeSingle();
  if (isMissingTable(s.error)) return { dbReady: false as const, blockers: ['Booking database is not set up yet.'] };
  if (s.error) throw new ConsoleError('Could not read booking settings');
  const settings = settingsFromRow(s.data);
  const m = await d.db.from('be_room_mapping').select('*');
  const mapping: ChannelMapping[] = (m.data ?? []).map((r: any) => ({ roomTypeId: r.room_type_id, roomCode: r.staah_room_code ?? '', rateCode: r.staah_rate_code ?? '' }));
  const ids = BOOKING_ROOM_TYPES.map((r) => r.id);
  const state = {
    switchedOn: settings.engineSwitchedOn,
    gatewayConfigured: gatewayOf(d) !== null,
    botProtection: botCheckConfigured(d.env),
    channelConnected: channelOf(d).connected,
    unmappedRoomTypes: unmappedRoomTypes(ids, mapping),
    feeTableProblems: validateFeeTable(settings.feeTable),
    databaseReady: true,
  };
  return { dbReady: true as const, settings, mapping, state, blockers: launchBlockers(state) };
}

export async function saveSettings(d: ConsoleDeps, input: SettingsInput) {
  const { problems, warnings } = reviewSettings(input);
  if (problems.length) throw new ConsoleError(problems.join(' '));
  const { error } = await d.db.from('be_settings').update({
    active_gateway: input.activeGateway, hold_minutes: input.holdMinutes, fee_table: input.feeTable,
    gst_slabs: input.gstSlabs, breakfast_gst: input.breakfastGst, updated_at: d.now.toISOString(),
  }).eq('id', 1);
  if (error) throw new ConsoleError(isMissingTable(error) ? 'Booking database is not set up yet.' : 'Could not save settings');
  await audit(d, 'settings.save', { holdMinutes: input.holdMinutes, gateway: input.activeGateway, feeTable: input.feeTable, gstSlabs: input.gstSlabs });
  return { ok: true, warnings };
}

/** Turning live booking on is refused while anything else blocks launch; turning it off always works. */
export async function setLaunchSwitch(d: ConsoleDeps, on: boolean) {
  const status = await loadStatus(d);
  if (!status.dbReady) throw new ConsoleError('Booking database is not set up yet.');
  if (on) {
    const others = launchBlockers({ ...status.state, switchedOn: true });
    if (others.length) throw new ConsoleError(`Live booking cannot start yet: ${others.join(' ')}`);
  }
  const { error } = await d.db.from('be_settings').update({ engine_switched_on: on, updated_at: d.now.toISOString() }).eq('id', 1);
  if (error) throw new ConsoleError('Could not change the switch');
  await audit(d, on ? 'launch.on' : 'launch.off', {});
  return { ok: true, on };
}

export async function saveMapping(d: ConsoleDeps, rows: ChannelMapping[]) {
  const known = new Set(BOOKING_ROOM_TYPES.map((r) => r.id));
  const bad = rows.filter((r) => !known.has(r.roomTypeId));
  if (bad.length) throw new ConsoleError(`Unknown room types: ${bad.map((r) => r.roomTypeId).join(', ')}`);
  const { error } = await d.db.from('be_room_mapping').upsert(rows.map((r) => ({
    room_type_id: r.roomTypeId, staah_room_code: r.roomCode.trim(), staah_rate_code: r.rateCode.trim(), updated_at: d.now.toISOString(),
  })));
  if (error) throw new ConsoleError(isMissingTable(error) ? 'Booking database is not set up yet.' : 'Could not save mapping');
  await audit(d, 'mapping.save', { rows: rows.length });
  return { ok: true };
}

export async function listBookings(d: ConsoleDeps, f: { status?: string; from?: IsoDate; to?: IsoDate; search?: string }) {
  let q = d.db.from('be_bookings').select('id,reference,status,check_in,check_out,guest_name,guest_phone,guests,total_paise,advance_paise,balance_paise,channel_status,created_at').order('check_in', { ascending: true }).limit(200);
  if (f.status) q = q.eq('status', f.status);
  if (f.from) q = q.gte('check_in', f.from);
  if (f.to) q = q.lte('check_in', f.to);
  if (f.search) q = q.or(`reference.ilike.%${f.search.replace(/[%,()]/g, '')}%,guest_name.ilike.%${f.search.replace(/[%,()]/g, '')}%`);
  const { data, error } = await q;
  if (isMissingTable(error)) return { dbReady: false as const, rows: [] };
  if (error) throw new ConsoleError('Could not load bookings');
  return { dbReady: true as const, rows: data ?? [] };
}

export async function getBooking(d: ConsoleDeps, id: string) {
  const b = await d.db.from('be_bookings').select('*').eq('id', id).maybeSingle();
  if (b.error || !b.data) throw new ConsoleError('Booking not found');
  const [lines, payments, invoices, channel, guests] = await Promise.all([
    d.db.from('be_booking_lines').select('*').eq('booking_id', id),
    d.db.from('be_payments').select('*').eq('booking_id', id).order('created_at'),
    d.db.from('be_invoices').select('*').eq('booking_id', id).order('issued_at'),
    d.db.from('be_channel_log').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
    d.db.from('be_guests').select('id,full_name,gender,nationality,form_c_status').eq('booking_id', id),
  ]);
  const booking = b.data;
  const change = canChangeDates({ status: booking.status as BookingStatus, checkIn: booking.check_in, dateChangesUsed: booking.date_changes_used }, d.now);
  return { booking, lines: lines.data ?? [], payments: payments.data ?? [], invoices: invoices.data ?? [], channelLog: channel.data ?? [], guests: guests.data ?? [], dateChange: change };
}

/**
 * Applies the guest's one date change. Needs STAAH to confirm the new nights are free.
 * A higher price adds the difference to the balance; a lower one refunds nothing (no-refund policy).
 */
export async function changeDates(d: ConsoleDeps, id: string, checkIn: IsoDate, checkOut: IsoDate) {
  const { booking, lines } = await getBooking(d, id);
  const decision = canChangeDates({ status: booking.status, checkIn: booking.check_in, dateChangesUsed: booking.date_changes_used }, d.now);
  if (!decision.allowed) throw new ConsoleError(decision.reason);
  if (!channelOf(d).connected) throw new ConsoleError('STAAH is not connected, so the new dates cannot be checked against OTA bookings.');
  if (stayNights(checkIn, checkOut).length === 0) throw new ConsoleError('Check-out must be after check-in.');
  const q = quoteStay({ checkIn, checkOut, breakfastGuests: 0, rooms: lines.map((l: any) => ({ roomTypeId: l.room_type_id, units: l.units, guests: l.guests })) });
  const extra = Math.max(0, q.total - booking.total_paise);
  const { error } = await d.db.from('be_bookings').update({
    check_in: checkIn, check_out: checkOut, date_changes_used: booking.date_changes_used + 1,
    total_paise: booking.total_paise + extra, balance_paise: booking.balance_paise + extra,
    channel_status: 'pending', updated_at: d.now.toISOString(),
  }).eq('id', id);
  if (error) throw new ConsoleError('Could not save the new dates');
  await audit(d, 'booking.date_change', { reference: booking.reference, from: [booking.check_in, booking.check_out], to: [checkIn, checkOut], extra });
  return { ok: true, extra };
}

/** Guest cancellations keep everything paid; XTSY cancellations refund it all (issued from the gateway). */
export async function cancelBooking(d: ConsoleDeps, id: string, by: 'guest' | 'xtsy', reason: string) {
  if (reason.trim().length < 5) throw new ConsoleError('Write the reason for the cancellation.');
  const { booking, payments } = await getBooking(d, id);
  if (String(booking.status).startsWith('cancelled')) throw new ConsoleError('This booking is already cancelled.');
  const paid = payments.filter((p: any) => p.status === 'succeeded' && p.kind !== 'refund').reduce((s: number, p: any) => s + Number(p.amount_paise), 0);
  const refund = refundOnCancel(by, paid);
  const { error } = await d.db.from('be_bookings').update({
    status: by === 'guest' ? 'cancelled_by_guest' : 'cancelled_by_xtsy', cancel_reason: reason.trim(), channel_status: 'pending', updated_at: d.now.toISOString(),
  }).eq('id', id);
  if (error) throw new ConsoleError('Could not cancel');
  await audit(d, `booking.cancel.${by}`, { reference: booking.reference, paid, refund, reason: reason.trim() });
  return { ok: true, paid, refund };
}

/** The 75% balance as a payment link the guest pays at check-in. */
export async function createBalanceLink(d: ConsoleDeps, id: string, method?: PaymentMethod) {
  const { booking, payments } = await getBooking(d, id);
  if (!['confirmed', 'checked_in'].includes(booking.status)) throw new ConsoleError('A balance link is only for confirmed or checked-in bookings.');
  const paidBalance = payments.filter((p: any) => p.kind === 'balance' && p.status === 'succeeded').reduce((s: number, p: any) => s + Number(p.amount_paise), 0);
  const due = Number(booking.balance_paise) - paidBalance;
  if (due <= 0) throw new ConsoleError('Nothing is due on this booking.');
  const gateway = gatewayOf(d);
  if (!gateway) throw new ConsoleError('Payment gateway keys are not saved yet.');
  const link = await gateway.createPaymentLink({ reference: booking.reference, amount: due, description: `Balance for ${booking.reference}`, method, expiresOn: booking.check_out });
  await d.db.from('be_payments').insert({ booking_id: id, kind: 'balance', gateway: gateway.id, link_id: link.linkId, link_url: link.url, method_declared: method ?? null, amount_paise: due, status: 'created' });
  await audit(d, 'payment.balance_link', { reference: booking.reference, due });
  return { ok: true, url: link.url, due };
}

/** Console buttons for STAAH: connection status, a rates pull, and a test booking push. */
export async function staahTest(d: ConsoleDeps, action: 'status' | 'pull' | 'push_test') {
  const ch = channelOf(d);
  let ok = false, detail = '';
  try {
    if (action === 'status') { ok = ch.connected; detail = ch.connected ? 'STAAH is connected.' : 'STAAH is not connected yet.'; }
    if (action === 'pull') {
      const today = todayInIndia(d.now);
      const ari = await ch.getAri(BOOKING_ROOM_TYPES.map((r) => r.id), today, addDays(today, 14));
      ok = true; detail = `Received ${ari.length} night(s) of rates and availability.`;
    }
    if (action === 'push_test') {
      const r = await ch.pushReservation({ reference: `TEST-${d.now.getTime()}`, status: 'confirmed', checkIn: todayInIndia(d.now), checkOut: addDays(todayInIndia(d.now), 1), rooms: [], guestName: 'XTSY console test', total: 0, paid: 0 });
      ok = r.acknowledged; detail = ok ? `STAAH acknowledged the test booking${r.channelId ? ` (${r.channelId})` : ''}.` : 'STAAH did not acknowledge the test booking.';
    }
  } catch (e) {
    detail = e instanceof Error ? e.message : 'STAAH request failed';
  }
  await d.db.from('be_channel_log').insert({ direction: 'test', message_type: action, status: ok ? 'ok' : 'failed', detail });
  return { ok, detail };
}

export async function channelLog(d: ConsoleDeps) {
  const { data, error } = await d.db.from('be_channel_log').select('*').order('created_at', { ascending: false }).limit(50);
  if (isMissingTable(error)) return { dbReady: false as const, rows: [] };
  return { dbReady: true as const, rows: data ?? [] };
}

export async function runNightAudit(d: ConsoleDeps) {
  const b = await d.db.from('be_bookings').select('id,reference,status,check_in,check_out,advance_paise,balance_paise,channel_status').neq('status', 'expired');
  if (isMissingTable(b.error)) return { dbReady: false as const, issues: [] };
  const p = await d.db.from('be_payments').select('id,booking_id,kind,status,amount_paise,method_declared,method_actual,settled_paise,created_at');
  const issues = nightAudit((b.data ?? []) as AuditBooking[], (p.data ?? []) as AuditPayment[], todayInIndia(d.now));
  await audit(d, 'night_audit.run', { issues: issues.length });
  return { dbReady: true as const, issues, ranAt: d.now.toISOString() };
}

export async function auditLog(d: ConsoleDeps) {
  const { data, error } = await d.db.from('be_audit_log').select('*').order('created_at', { ascending: false }).limit(100);
  if (isMissingTable(error)) return { dbReady: false as const, rows: [] };
  return { dbReady: true as const, rows: data ?? [] };
}

export type { FeeTable };
