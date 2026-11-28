/**
 * The guest-facing booking engine: search, checkout and payment confirmation.
 *
 * Flow (modelled on Zostel's stay page): pick dates → each room type shows its price per bed or
 * room, how many are left for the whole stay and a 7-night strip → choose units → guest details,
 * policy acceptance and payment method → pay the 25% advance on Zoho's hosted checkout → the
 * verified webhook (or the return page) confirms the booking.
 *
 * Every function takes its dependencies (service-role database, gateway, channel manager, clock)
 * so the logic is tested without a live database. Checkout is refused unless launchGate allows
 * live bookings; search works in preview so the owner can review the page first.
 */
import { breakfastItem, type BreakfastPick } from '@/data/breakfastMenu';
import { BOOKING_ROOM_TYPES, findRoomType, type BookingRoomType } from './catalogue';
import { channelNotConnected, type ChannelManager } from './channel/channelManager';
import { hostelChannelStatus, loadOtaBookings, zimmerstackChannel } from './channel/zimmerstack.server';
import { otaHolds } from './channel/zimmerstackPlan';
import { addDays, daysBetween, isIsoDate, stayNights, todayInIndia, type IsoDate } from './dates';
import { freeUnitsPerNight, type Hold, type NightLoad } from './availability';
import { closureFromRow, freeAfterClosures, type ClosureRow } from './consoleClosures';
import { sheetCapacity, type SheetAvailability } from './sheetAvailability';
import { canTakeLiveBookings, launchBlockers, type LaunchState } from './launchGate';
import { settingsFromRow, type BookingSettings } from './consoleSettings';
import { quoteStay, chargeFor, type Quote } from './pricing';
import { validateFeeTable, type PaymentMethod } from './payments/fees';
import { webhookKey, type PaymentGateway } from './payments/gateway';
import { createZohoGateway, zohoConfigFromEnv } from './payments/zoho.server';
import { financialYear, invoiceNumber } from './invoiceNumber';
import { HOSTEL_POLICIES } from '@/data/hostelPolicies';
import type { Paise } from './money';
import { isIndian } from './guestRules';
import { nearestOpenStays, suggestionRange, type OpenStay } from './nearestDates';
import { botCheckConfigured, verifyBotCheck } from './botCheck';

type Db = any;
export interface EngineDeps {
  db: Db | null;
  env: Record<string, string | undefined>;
  now: Date;
  channel?: ChannelManager;
  gateway?: PaymentGateway | null;
  /** For the bot check; defaults to global fetch. */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

export class EngineError extends Error {}

/** Nights shown in each room's availability strip, from the chosen check-in. */
export const STRIP_NIGHTS = 7;
/** How far ahead guests can book. */
export const BOOKING_WINDOW_DAYS = 365;
/** Per checkout: stops one visitor from holding the whole hostel. */
export const MAX_BEDS_PER_BOOKING = 8;
export const MAX_ROOMS_PER_BOOKING = 3;
/** Zoho payment sessions last at most 15 minutes. */
const MAX_CHECKOUT_SECONDS = 900;

const LIVE_STATUSES = ['confirmed', 'checked_in'];
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** The channel manager (ZimmerStack) for XTSY Travellers Hostel, as the console has set it up. */
async function channelOf(d: EngineDeps): Promise<ChannelManager> {
  if (d.channel) return d.channel;
  if (!d.db) return channelNotConnected();
  const zs = { db: d.db, env: d.env, now: d.now };
  return zimmerstackChannel(zs, await hostelChannelStatus(zs).catch(() => ({ connected: false, unmapped: BOOKING_ROOM_TYPES.map((r) => r.id) })));
}
export const gatewayOf = (d: EngineDeps): PaymentGateway | null => {
  if (d.gateway !== undefined) return d.gateway;
  const cfg = zohoConfigFromEnv(d.env);
  return cfg ? createZohoGateway(cfg) : null;
};

const isMissingTable = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (['42P01', '42883', 'PGRST205', 'PGRST202'].includes(e.code ?? '') || /does not exist|could not find the (table|function)/i.test(e.message ?? ''));

export function newReference(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return 'XTSY-' + Array.from(random(6), (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
}

// ---------------------------------------------------------------- state

interface EngineState {
  dbReady: boolean;
  settings: BookingSettings;
  launch: LaunchState;
  live: boolean;
}

async function loadState(d: EngineDeps): Promise<EngineState> {
  const fallback = settingsFromRow(null);
  const channel = await channelOf(d);
  const base: LaunchState = {
    switchedOn: false, gatewayConfigured: gatewayOf(d) !== null, botProtection: botCheckConfigured(d.env), channelConnected: channel.connected,
    unmappedRoomTypes: BOOKING_ROOM_TYPES.map((r) => r.id), feeTableProblems: [], databaseReady: false,
  };
  if (!d.db) return { dbReady: false, settings: fallback, launch: base, live: false };
  const s = await d.db.from('be_settings').select('*').eq('id', 1).maybeSingle();
  if (s.error) return { dbReady: false, settings: fallback, launch: base, live: false };
  const settings = settingsFromRow(s.data);
  const launch: LaunchState = {
    ...base,
    switchedOn: settings.engineSwitchedOn,
    unmappedRoomTypes: channel.unmapped,
    feeTableProblems: validateFeeTable(settings.feeTable),
    databaseReady: true,
  };
  return { dbReady: true, settings, launch, live: canTakeLiveBookings(launch) };
}

/** What /book needs to decide between the live engine and the WhatsApp enquiry flow. */
export async function engineStatus(d: EngineDeps): Promise<{ live: boolean }> {
  return { live: (await loadState(d)).live };
}

/** /book on load: whether payment is live, plus console-uploaded photos by room type. */
export async function bookPageData(d: EngineDeps): Promise<{ live: boolean; photos: Record<string, { src: string; alt: string }[]>; closures: ClosureRow[]; sheet: SheetAvailability; refreshAt: number }> {
  const sheetP = loadSheetAvailability(d).catch(() => ({} as SheetAvailability));
  const [status, photos, closures, sheet] = await Promise.all([engineStatus(d), loadRoomPhotos(d).catch(() => new Map()), sheetP.then((s) => loadClosures(d, s)).catch(() => []), sheetP]);
  // Next minute boundary: when the next published snapshot (if any) becomes visible to everyone.
  return { live: status.live, photos: Object.fromEntries(photos), closures, sheet, refreshAt: (Math.floor(d.now.getTime() / 60_000) + 1) * 60_000 };
}

/**
 * The Google Sheet snapshot published for the current minute (from today to its last month).
 * Snapshots are versioned by minute and a new one only becomes visible at a minute boundary, so
 * every guest on the site sees the same numbers at the same time.
 */
export async function loadSheetAvailability(d: EngineDeps): Promise<SheetAvailability> {
  if (!d.db) return {};
  const from = todayInIndia(d.now);
  const out: SheetAvailability = {};
  const current = await d.db.from('be_sheet_availability').select('version').lte('version', Math.floor(d.now.getTime() / 60_000)).order('version', { ascending: false }).limit(1);
  const version = current.data?.[0]?.version;
  if (current.error || version === undefined) return out;
  // Pages are fetched in parallel batches (one round trip for typical sheets) instead of one by one.
  const add = (rows: { room_type_id: string; night: string; free: number }[]) => { for (const row of rows) (out[row.room_type_id] ??= {})[row.night.slice(0, 10) as IsoDate] = row.free; };
  const BATCH = 6;
  for (let start = 0; start < 20; start += BATCH) {
    const pages = await Promise.all(Array.from({ length: Math.min(BATCH, 20 - start) }, (_, i) =>
      d.db!.from('be_sheet_availability').select('room_type_id,night,free').eq('version', version).gte('night', from).order('night').order('room_type_id').range((start + i) * 1000, (start + i) * 1000 + 999)));
    let done = false;
    for (const r of pages) {
      if (r.error) return out;
      const rows = (r.data ?? []) as { room_type_id: string; night: string; free: number }[];
      add(rows);
      if (rows.length < 1000) { done = true; break; }
    }
    if (done) break;
  }
  return out;
}

/**
 * Blocks and openings from the console (Stays → Block or open dates) that end today or later,
 * plus the rooms OTA bookings hold (as block rows). The /book page applies them to every room
 * count, so a blocked night shows as full.
 */
export async function loadClosures(d: EngineDeps, sheetNow?: SheetAvailability): Promise<ClosureRow[]> {
  if (!d.db) return [];
  const [r, ota] = await Promise.all([
    d.db.from('console_inventory_overrides').select('*').gte('end_date', todayInIndia(d.now)).order('created_at', { ascending: true }),
    loadOtaBookings({ db: d.db, now: d.now }).catch(() => []),
  ]);
  const rows: ClosureRow[] = r.error ? [] : (r.data ?? []).map((row: Record<string, unknown>) => closureFromRow(row)).filter((x: ClosureRow | null): x is ClosureRow => x !== null);
  if (!ota.length) return rows;
  // OTA bookings from ZimmerStack hold their rooms until the owner edits those nights in the sheet.
  const sheet = sheetNow ?? await loadSheetAvailability(d).catch(() => ({} as SheetAvailability));
  return [...rows, ...otaHolds(ota, sheet, todayInIndia(d.now))];
}

// ---------------------------------------------------------------- availability

interface Loads { confirmed: NightLoad[]; holds: Hold[] }

async function loadLoads(d: EngineDeps, from: IsoDate, to: IsoDate): Promise<Loads> {
  if (!d.db) return { confirmed: [], holds: [] };
  const q = (cols: string) => d.db!.from('be_bookings').select(cols).in('status', LIVE_STATUSES).lt('check_in', to).gt('check_out', from);
  let b = await q('check_in,check_out,status,channel_status,sheet_write,be_booking_lines(room_type_id,units)');
  if (b.error && !isMissingTable(b.error)) b = await q('check_in,check_out,status,channel_status,be_booking_lines(room_type_id,units)'); // before the write-back migration
  if (b.error && !isMissingTable(b.error)) throw new EngineError('Could not read bookings');
  const confirmed: NightLoad[] = [];
  for (const row of (b.data ?? []) as any[]) {
    // The sheet is the master count. A website booking is counted here until the sheet's script has
    // written it into the sheet (sheet_write 'applied'); from then on the sheet's count includes it.
    if (row.sheet_write === 'applied') continue;
    for (const line of row.be_booking_lines ?? []) {
      for (const night of stayNights(row.check_in, row.check_out)) {
        confirmed.push({ roomTypeId: line.room_type_id, night, units: Number(line.units) });
      }
    }
  }
  const h = await d.db.from('be_holds').select('room_type_id,units,nights,expires_at').gt('expires_at', d.now.toISOString());
  if (h.error && !isMissingTable(h.error)) throw new EngineError('Could not read holds');
  const holds: Hold[] = (h.data ?? []).map((x: any) => ({ roomTypeId: x.room_type_id, units: Number(x.units), nights: x.nights, expiresAt: new Date(x.expires_at) }));
  return { confirmed, holds };
}

export const ROOM_PHOTO_BUCKET = 'room-photos';

/** Public URL of an uploaded room photo. */
export function roomPhotoUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${ROOM_PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Console-managed photos by room type. Any failure falls back to the built-in galleries. */
export async function loadRoomPhotos(d: EngineDeps): Promise<Map<string, { src: string; alt: string }[]>> {
  const out = new Map<string, { src: string; alt: string }[]>();
  const base = d.env['SUPABASE_URL'];
  if (!d.db || !base) return out;
  const r = await d.db.from('be_room_photos').select('room_type_id,path,alt,sort').order('sort', { ascending: true });
  if (r.error) return out;
  for (const row of r.data ?? []) {
    const list = out.get(row.room_type_id) ?? [];
    list.push({ src: roomPhotoUrl(base, row.path), alt: row.alt ?? '' });
    out.set(row.room_type_id, list);
  }
  return out;
}

export interface NightCell { night: IsoDate; free: number; rate: Paise; closed: boolean }
export interface RoomResult {
  id: string;
  name: string;
  descriptor?: string;
  soldAs: BookingRoomType['soldAs'];
  femaleOnly: boolean;
  maxGuestsPerUnit: number;
  /** Lowest nightly rate across the stay, per bed or room, before GST. */
  fromRate: Paise;
  /** Units free on every night of the stay; 0 means sold out for these dates. */
  freeForStay: number;
  strip: NightCell[];
  /** Photos the admin uploaded in the console, in order; empty means use the built-in gallery. */
  photos: { src: string; alt: string }[];
  /** Beds or rooms of this type in total (enquiry mode shows "N left" only when the console has closed some). */
  totalUnits?: number;
}
export interface SearchResult {
  live: boolean;
  /** True when the channel manager is connected, so OTA sales reach these counts as soon as they happen. */
  inventorySynced: boolean;
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  rooms: RoomResult[];
  /** Lowest rate among room types with space, for the "From ₹…" summary. */
  fromRate: Paise | null;
  /** When nothing has space: the closest stays of the same length that do (closest first). */
  suggestions?: OpenStay[];
}

export function validateDates(checkIn: string, checkOut: string, now: Date): { checkIn: IsoDate; checkOut: IsoDate } {
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) throw new EngineError('Choose valid check-in and check-out dates.');
  const today = todayInIndia(now);
  if (daysBetween(today, checkIn) < 0) throw new EngineError('Check-in cannot be in the past.');
  if (daysBetween(today, checkIn) > BOOKING_WINDOW_DAYS) throw new EngineError('Bookings open up to one year ahead.');
  const n = daysBetween(checkIn, checkOut);
  if (n < 1) throw new EngineError('Check-out must be after check-in.');
  if (n > 30) throw new EngineError('Stays longer than 30 nights are booked through the desk.');
  return { checkIn, checkOut };
}

export async function searchStays(d: EngineDeps, q: { checkIn: string; checkOut: string }): Promise<SearchResult> {
  const { checkIn, checkOut } = validateDates(q.checkIn, q.checkOut, d.now);
  const state = await loadState(d);
  const stayLen = daysBetween(checkIn, checkOut);
  const span = Math.max(stayLen, STRIP_NIGHTS);
  const rangeEnd = addDays(checkIn, span);
  const loads = await loadLoads(d, checkIn, rangeEnd);
  const photos = await loadRoomPhotos(d);
  const sheet = await loadSheetAvailability(d).catch(() => ({} as SheetAvailability));
  const closures = await loadClosures(d, sheet).catch(() => [] as ClosureRow[]);

  const rooms: RoomResult[] = BOOKING_ROOM_TYPES.map((room) => {
    // Counts come from the Google Sheet, console blocks and OTA bookings; no channel restrictions yet.
    const blocked = new Set<IsoDate>();
    const free = freeUnitsPerNight({
      roomTypeId: room.id, checkIn, checkOut: rangeEnd,
      capacity: (night) => freeAfterClosures(closures, room.id, night, sheetCapacity(sheet, room.id, night, room.units)),
      confirmed: loads.confirmed, holds: loads.holds, blockedNights: blocked, now: d.now,
    });
    const strip: NightCell[] = free.slice(0, STRIP_NIGHTS).map(({ night, free: f }) => ({
      night, free: f, rate: room.rate, closed: blocked.has(night),
    }));
    const stay = free.slice(0, stayLen);
    const rates = stay.map(() => room.rate);
    return {
      id: room.id, name: room.name, descriptor: room.descriptor, soldAs: room.soldAs, femaleOnly: room.femaleOnly,
      maxGuestsPerUnit: room.maxGuestsPerUnit,
      fromRate: Math.min(...rates),
      freeForStay: stay.length ? Math.min(...stay.map((n) => n.free)) : 0,
      strip,
      photos: photos.get(room.id) ?? [],
    };
  });
  const open = rooms.filter((r) => r.freeForStay > 0);
  // Full: look a week back and two weeks ahead for the closest stays of the same length.
  let suggestions: OpenStay[] | undefined;
  if (!open.length) {
    const today = todayInIndia(d.now);
    const range = suggestionRange(checkIn, stayLen, today);
    const wide = await loadLoads(d, range.from, range.to);
    const perRoom = BOOKING_ROOM_TYPES.map((room) => ({
      rate: room.rate,
      free: new Map(freeUnitsPerNight({
        roomTypeId: room.id, checkIn: range.from, checkOut: range.to,
        capacity: (night) => freeAfterClosures(closures, room.id, night, sheetCapacity(sheet, room.id, night, room.units)),
        confirmed: wide.confirmed, holds: wide.holds, blockedNights: new Set(), now: d.now,
      }).map((n) => [n.night, n.free] as const)),
    }));
    suggestions = nearestOpenStays(checkIn, stayLen, today, BOOKING_WINDOW_DAYS, (ci, co) => {
      const rates = perRoom.filter((r) => stayNights(ci, co).every((n) => (r.free.get(n) ?? 0) > 0)).map((r) => r.rate);
      return rates.length ? Math.min(...rates) : null;
    });
  }
  return {
    live: state.live, inventorySynced: state.launch.channelConnected, checkIn, checkOut, nights: stayLen, rooms,
    fromRate: open.length ? Math.min(...open.map((r) => r.fromRate)) : null,
    ...(suggestions ? { suggestions } : {}),
  };
}

// ---------------------------------------------------------------- checkout

export interface CheckoutInput {
  checkIn: string;
  checkOut: string;
  rooms: { roomTypeId: string; units: number; guests: number }[];
  /** TAB Bistro breakfast picks, each served every morning. */
  breakfast: BreakfastPick[];
  /** The lead guest. Gender is checked against female-only dorms; nationality decides Form C. */
  guest: { name: string; phone: string; email: string; gender: 'female' | 'male' | 'other'; nationality: string };
  method: PaymentMethod;
  policyAccepted: boolean;
  /** With more than one female-dorm bed: the other guests in it are female too. */
  femaleOnlyAck?: boolean;
  /** Cloudflare Turnstile token from the browser. */
  botToken?: string;
  skyViewAck?: boolean;
}

/** The quote and the advance the guest will pay, shown before they leave for the gateway. */
export function quoteCheckout(input: Pick<CheckoutInput, 'checkIn' | 'checkOut' | 'rooms' | 'breakfast' | 'method'>, settings: BookingSettings) {
  const quote = quoteStay({
    checkIn: input.checkIn, checkOut: input.checkOut, rooms: input.rooms, breakfast: input.breakfast,
    gstSlabFor: (id) => settings.gstSlabs[id], breakfastGstSlab: settings.breakfastGst,
  });
  return { quote, advanceCharge: chargeFor(quote.advance, input.method, settings.feeTable) };
}

export function checkoutProblems(input: CheckoutInput): string[] {
  const out: string[] = [];
  if (!input.policyAccepted) out.push('Please accept the booking policy.');
  if (input.rooms.length === 0) out.push('Choose at least one bed or room.');
  const ids = new Set<string>();
  let beds = 0, rooms = 0;
  for (const r of input.rooms) {
    const room = findRoomType(r.roomTypeId);
    if (!room) { out.push(`Unknown room type: ${r.roomTypeId}`); continue; }
    if (ids.has(r.roomTypeId)) out.push(`${room.name} is listed twice.`);
    ids.add(r.roomTypeId);
    if (room.soldAs === 'bed') beds += r.units; else rooms += r.units;
    if (room.femaleOnly && input.guest.gender !== 'female') out.push(`Gender mismatch: ${room.name} is for female guests only. Check the lead guest’s gender or choose another room.`);
    if (room.femaleOnly && r.units > 1 && !input.femaleOnlyAck) out.push(`Please confirm every guest in ${room.name} is female.`);
    if (room.id === 'experience-by-xtsy' && !input.skyViewAck) out.push('Please confirm you understand the suite’s sky view depends on the weather.');
  }
  if (beds > MAX_BEDS_PER_BOOKING) out.push(`Up to ${MAX_BEDS_PER_BOOKING} beds per online booking; for groups, message the desk.`);
  if (rooms > MAX_ROOMS_PER_BOOKING) out.push(`Up to ${MAX_ROOMS_PER_BOOKING} rooms per online booking; for groups, message the desk.`);
  if (input.breakfast.length > 30) out.push('Choose up to 30 breakfast items.');
  for (const b of input.breakfast) if (!breakfastItem(b.item)) out.push('A breakfast item is not on the TAB Bistro menu.');
  if (!/^\+?[0-9 ]{10,15}$/.test(input.guest.phone.trim())) out.push('Enter a valid phone number.');
  if (input.guest.name.trim().length < 2) out.push('Enter the guest’s full name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.guest.email.trim())) out.push('Enter a valid email for your receipt.');
  if (!['female', 'male', 'other'].includes(input.guest.gender)) out.push('Choose the lead guest’s gender.');
  if (input.guest.nationality.trim().length < 2) out.push('Choose a nationality.');
  return out;
}

const normalisePhone = (p: string) => p.replace(/[^0-9+]/g, '');

async function freeForStay(d: EngineDeps, roomTypeId: string, checkIn: IsoDate, checkOut: IsoDate): Promise<number> {
  const res = await searchStays({ ...d }, { checkIn, checkOut });
  return res.rooms.find((r) => r.id === roomTypeId)?.freeForStay ?? 0;
}

export async function startCheckout(d: EngineDeps, input: CheckoutInput, origin: string, remoteIp?: string): Promise<{ reference: string; redirectUrl: string }> {
  const { checkIn, checkOut } = validateDates(input.checkIn, input.checkOut, d.now);
  const problems = checkoutProblems(input);
  if (problems.length) throw new EngineError(problems.join(' '));
  const state = await loadState(d);
  if (!state.live) throw new EngineError(`Online booking is not open yet. ${launchBlockers(state.launch).join(' ')}`.trim());
  if (!(await verifyBotCheck(d.env, input.botToken, remoteIp, d.fetch))) throw new EngineError('Please complete the “I am human” check and try again.');
  const gateway = gatewayOf(d);
  if (!gateway || !d.db) throw new EngineError('Online payment is not available right now.');
  const db = d.db;
  const phone = normalisePhone(input.guest.phone);

  // A supplied phone is contact information, not proof of booking ownership.
  // Do not look up another booking by it; bot checks, unit caps and live holds still apply.

  for (const r of input.rooms) {
    if ((await freeForStay(d, r.roomTypeId, checkIn, checkOut)) < r.units) {
      throw new EngineError(`${findRoomType(r.roomTypeId)!.name} no longer has ${r.units} free for these dates.`);
    }
  }
  const { quote } = quoteCheckout({ ...input, checkIn, checkOut }, state.settings);
  const reference = newReference();
  const nights = stayNights(checkIn, checkOut);
  const holdMinutes = Math.min(state.settings.holdMinutes, MAX_CHECKOUT_SECONDS / 60);
  const expiresAt = new Date(d.now.getTime() + holdMinutes * 60_000);
  const guests = input.rooms.reduce((s, r) => s + r.guests, 0);

  const ins = await db.from('be_bookings').insert({
    reference, status: 'held', source: 'website', check_in: checkIn, check_out: checkOut,
    guest_name: input.guest.name.trim(), guest_email: input.guest.email.trim(), guest_phone: phone,
    nationality: input.guest.nationality.trim(), guests,
    taxable_paise: quote.taxable, gst_paise: quote.gst, total_paise: quote.total,
    advance_paise: quote.advance, balance_paise: quote.balance,
    policy_version: state.settings.policyVersion, policy_accepted_at: d.now.toISOString(),
    stargazing_ack_at: input.skyViewAck ? d.now.toISOString() : null,
    channel_status: 'pending',
  }).select('id').single();
  if (ins.error || !ins.data) throw new EngineError('Could not start the booking. Please try again.');
  const bookingId: string = ins.data.id;
  const fail = async (msg: string): Promise<never> => {
    await db.from('be_holds').delete().eq('booking_id', bookingId);
    await db.from('be_bookings').update({ status: 'expired', updated_at: d.now.toISOString() }).eq('id', bookingId);
    throw new EngineError(msg);
  };

  const roomLines = quote.lines.filter((l) => !l.label.startsWith('Breakfast'));
  await db.from('be_booking_lines').insert(input.rooms.map((r, i) => ({
    booking_id: bookingId, room_type_id: r.roomTypeId, units: r.units, guests: r.guests,
    taxable_paise: roomLines[i].taxable, gst_bps: roomLines[i].gstBps, gst_paise: roomLines[i].gst,
  })));
  await db.from('be_guests').insert({
    booking_id: bookingId, full_name: input.guest.name.trim(), gender: input.guest.gender,
    nationality: input.guest.nationality.trim(),
    // Foreign nationals need a Form C within 24 hours of arrival.
    form_c_status: isIndian(input.guest.nationality) ? 'not_required' : 'due',
  });
  await db.from('be_holds').insert(input.rooms.map((r) => ({
    booking_id: bookingId, room_type_id: r.roomTypeId, units: r.units, nights, expires_at: expiresAt.toISOString(),
  })));

  // Two guests can pass the first check at the same moment; re-check with every live hold
  // (ours included) counted, and back out if any night is now over capacity.
  if (await oversold(d, input.rooms, checkIn, checkOut)) await fail('Those beds were just taken. Please choose again.');

  let checkout;
  try {
    checkout = await gateway.createCheckout({
      reference, amount: quote.advance,
      description: `XTSY ${reference}: ${HOSTEL_POLICIES.advancePercent}% advance`,
      method: input.method,
      successUrl: `${origin}/book/confirmation?ref=${reference}`,
      failureUrl: `${origin}/book/confirmation?ref=${reference}&failed=1`,
      expiresInSeconds: holdMinutes * 60,
    });
  } catch {
    return fail('The payment page could not be opened. Please try again.');
  }
  await db.from('be_payments').insert({
    booking_id: bookingId, kind: 'advance', gateway: gateway.id, session_id: checkout.sessionId,
    method_declared: input.method, amount_paise: quote.advance, status: 'created',
  });
  return { reference, redirectUrl: checkout.redirectUrl };
}

/** True when confirmed bookings plus live holds exceed what any night can sell. */
async function oversold(d: EngineDeps, rooms: CheckoutInput['rooms'], checkIn: IsoDate, checkOut: IsoDate): Promise<boolean> {
  const loads = await loadLoads(d, checkIn, checkOut);
  const sheet = await loadSheetAvailability(d).catch(() => ({} as SheetAvailability));
  const closures = await loadClosures(d, sheet).catch(() => [] as ClosureRow[]);
  return rooms.some((r) => {
    const room = findRoomType(r.roomTypeId)!;
    return stayNights(checkIn, checkOut).some((night) => {
      const cap = freeAfterClosures(closures, room.id, night, sheetCapacity(sheet, room.id, night, room.units));
      const used = [...loads.confirmed.filter((l) => l.roomTypeId === room.id && l.night === night).map((l) => l.units),
        ...loads.holds.filter((h) => h.roomTypeId === room.id && h.expiresAt > d.now && h.nights.includes(night)).map((h) => h.units)]
        .reduce((s, u) => s + u, 0);
      return used > cap;
    });
  });
}

// ---------------------------------------------------------------- confirmation

/**
 * Re-reads the session from the gateway and applies it once. Called by the verified webhook and
 * by the confirmation page, so a booking confirms even if the webhook is late.
 */
export async function settleSession(d: EngineDeps, sessionId: string): Promise<'confirmed' | 'pending' | 'failed' | 'unknown'> {
  const gateway = gatewayOf(d);
  if (!gateway || !d.db) return 'unknown';
  const db = d.db;
  const p = await db.from('be_payments').select('id,booking_id,amount_paise,status,kind').eq('session_id', sessionId).maybeSingle();
  if (!p.data) return 'unknown';
  if (p.data.status === 'succeeded') return 'confirmed';
  const s = await gateway.getSession(sessionId);
  const at = d.now.toISOString();
  if (s.status === 'succeeded' && s.amount >= Number(p.data.amount_paise)) {
    await db.from('be_payments').update({ status: 'succeeded', payment_id: s.paymentIds[0] ?? null, updated_at: at }).eq('id', p.data.id);
    const b = await db.from('be_bookings').select('id,reference,status,check_in').eq('id', p.data.booking_id).single();
    if (b.data && ['held', 'expired'].includes(b.data.status)) {
      await db.from('be_bookings').update({ status: 'confirmed', updated_at: at }).eq('id', b.data.id);
      await db.from('be_holds').delete().eq('booking_id', b.data.id);
      const fy = financialYear(todayInIndia(d.now));
      const seq = await db.rpc('be_next_invoice_seq', { p_fy: fy, p_kind: 'advance_receipt' });
      if (!seq.error && typeof seq.data === 'number') {
        const bk = await db.from('be_bookings').select('advance_paise,gst_paise,total_paise').eq('id', b.data.id).single();
        const share = bk.data && Number(bk.data.total_paise) > 0 ? Number(bk.data.advance_paise) / Number(bk.data.total_paise) : 0;
        const gst = Math.round(Number(bk.data?.gst_paise ?? 0) * share);
        await db.from('be_invoices').insert({
          booking_id: b.data.id, kind: 'advance_receipt', fy, seq: seq.data, number: invoiceNumber('advance_receipt', fy, seq.data),
          taxable_paise: Number(bk.data?.advance_paise ?? 0) - gst, gst_paise: gst,
        });
      }
      await pushToChannel(d, b.data.id);
      // Paid: written into the owner's Google Sheet as "Name 2B XTSY" by the sheet's script
      // (once channel manager, PMS and payment are all live).
      const { queueWebsiteBooking } = await import('./sheetWrites.server');
      await queueWebsiteBooking({ db, env: d.env, now: d.now }, b.data.id).catch(() => null);
    }
    return 'confirmed';
  }
  if (s.status === 'failed' || s.status === 'expired') {
    await db.from('be_payments').update({ status: s.status, updated_at: at }).eq('id', p.data.id);
    await db.from('be_holds').delete().eq('booking_id', p.data.booking_id);
    await db.from('be_bookings').update({ status: 'expired', updated_at: at }).eq('id', p.data.booking_id).eq('status', 'held');
    return 'failed';
  }
  return 'pending';
}

async function pushToChannel(d: EngineDeps, bookingId: string) {
  const db = d.db;
  const channel = await channelOf(d);
  if (!channel.connected) {
    await db.from('be_channel_log').insert({ booking_id: bookingId, direction: 'out', message_type: 'reservation', status: 'pending', detail: 'Channel manager not connected; send when connected.' });
    return;
  }
  const b = await db.from('be_bookings').select('reference,check_in,check_out,guest_name,guest_phone,guest_email,total_paise,advance_paise,be_booking_lines(room_type_id,units,guests,taxable_paise)').eq('id', bookingId).single();
  if (!b.data) return;
  const nights = daysBetween(b.data.check_in, b.data.check_out);
  try {
    const r = await channel.pushReservation({
      reference: b.data.reference, status: 'confirmed', checkIn: b.data.check_in, checkOut: b.data.check_out,
      rooms: (b.data.be_booking_lines ?? []).map((l: any) => ({
        roomTypeId: l.room_type_id, units: Number(l.units), guests: Number(l.guests),
        nightlyRates: Array(nights).fill(Math.round(Number(l.taxable_paise) / nights / Number(l.units))),
      })),
      guestName: b.data.guest_name, guestPhone: b.data.guest_phone ?? undefined, guestEmail: b.data.guest_email ?? undefined,
      total: Number(b.data.total_paise), paid: Number(b.data.advance_paise),
    });
    await db.from('be_bookings').update({ channel_status: r.acknowledged ? 'synced' : 'failed', channel_id: r.channelId ?? null }).eq('id', bookingId);
    await db.from('be_channel_log').insert({ booking_id: bookingId, direction: 'out', message_type: 'reservation', status: r.acknowledged ? 'ok' : 'failed', detail: r.detail?.slice(0, 300) ?? null });
  } catch (e) {
    await db.from('be_bookings').update({ channel_status: 'failed' }).eq('id', bookingId);
    await db.from('be_channel_log').insert({ booking_id: bookingId, direction: 'out', message_type: 'reservation', status: 'failed', detail: e instanceof Error ? e.message.slice(0, 300) : 'push failed' });
  }
}

/** Verified gateway webhook → settle once. Unverified requests are ignored without detail. */
export async function handlePaymentWebhook(d: EngineDeps, rawBody: string, headers: Headers): Promise<{ status: number; body: string }> {
  const gateway = gatewayOf(d);
  if (!gateway || !d.db) return { status: 503, body: 'not configured' };
  const pointer = await gateway.verifyWebhook(rawBody, headers);
  if (!pointer) return { status: 401, body: 'invalid signature' };
  const key = webhookKey(gateway.id, pointer);
  const seen = await d.db.from('be_webhook_events').insert({ key, gateway: gateway.id });
  if (seen.error) {
    if (seen.error.code === '23505') return { status: 200, body: 'duplicate' };
    return { status: 500, body: 'could not record event' };
  }
  let sessionId = pointer.sessionId;
  if (!sessionId && pointer.paymentId) {
    const p = await d.db.from('be_payments').select('session_id').eq('payment_id', pointer.paymentId).maybeSingle();
    sessionId = p.data?.session_id ?? undefined;
  }
  if (sessionId) await settleSession(d, sessionId);
  else if (pointer.linkId) await settleLink(d, pointer.linkId);
  await d.db.from('be_webhook_events').update({ processed: true }).eq('key', key);
  return { status: 200, body: 'ok' };
}

/**
 * A balance payment link (75% paid before or at check-in): re-reads its state from the gateway and
 * records the payment once paid. Webhooks call it; so does the guest's "Manage my booking" page,
 * in case a webhook was missed.
 */
export async function settleLink(d: EngineDeps, linkId: string): Promise<'paid' | 'open' | 'closed' | 'unknown'> {
  const gateway = gatewayOf(d);
  if (!gateway?.getPaymentLink || !d.db) return 'unknown';
  const p = await d.db.from('be_payments').select('id,booking_id,status').eq('link_id', linkId).maybeSingle();
  if (!p.data) return 'unknown';
  if (p.data.status === 'succeeded') return 'paid';
  const l = await gateway.getPaymentLink(linkId).catch(() => null);
  if (!l) return 'unknown';
  const at = d.now.toISOString();
  if (l.status === 'paid') {
    await d.db.from('be_payments').update({ status: 'succeeded', payment_id: l.paymentIds[0] ?? null, updated_at: at }).eq('id', p.data.id).neq('status', 'succeeded');
    await d.db.from('be_audit_log').insert({ action: 'payment.balance_paid', details: { booking_id: p.data.booking_id, link_id: linkId } });
    return 'paid';
  }
  if (l.status === 'expired' || l.status === 'canceled') {
    await d.db.from('be_payments').update({ status: 'expired', updated_at: at }).eq('id', p.data.id).eq('status', 'created');
    return 'closed';
  }
  return 'open';
}

export interface PublicBooking {
  reference: string;
  status: 'confirmed' | 'pending' | 'failed' | 'cancelled';
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  rooms: { name: string; units: number; unit: 'bed' | 'room' }[];
  total: Paise;
  advance: Paise;
  balance: Paise;
  lastChangeDate: IsoDate;
}

/** Confirmation page data. No name, phone or email: the reference alone must not reveal a guest. */
export async function publicBooking(d: EngineDeps, reference: string): Promise<PublicBooking | null> {
  if (!d.db || !/^XTSY-[A-Z0-9]{6}$/.test(reference)) return null;
  const b = await d.db.from('be_bookings').select('id,reference,status,check_in,check_out,total_paise,advance_paise,balance_paise,be_booking_lines(room_type_id,units)').eq('reference', reference).maybeSingle();
  if (!b.data) return null;
  let status: PublicBooking['status'] = LIVE_STATUSES.includes(b.data.status) || b.data.status === 'settled' ? 'confirmed'
    : b.data.status.startsWith('cancelled') ? 'cancelled' : b.data.status === 'expired' ? 'failed' : 'pending';
  if (status === 'pending' || status === 'failed') {
    const p = await d.db.from('be_payments').select('session_id').eq('booking_id', b.data.id).eq('kind', 'advance').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (p.data?.session_id) {
      const r = await settleSession(d, p.data.session_id);
      if (r === 'confirmed') status = 'confirmed';
      else if (r === 'failed') status = 'failed';
    }
  }
  return {
    reference: b.data.reference, status, checkIn: b.data.check_in, checkOut: b.data.check_out,
    nights: daysBetween(b.data.check_in, b.data.check_out),
    rooms: (b.data.be_booking_lines ?? []).map((l: any) => {
      const room = findRoomType(l.room_type_id);
      return { name: room?.name ?? l.room_type_id, units: Number(l.units), unit: room?.soldAs ?? 'room' };
    }),
    total: Number(b.data.total_paise), advance: Number(b.data.advance_paise), balance: Number(b.data.balance_paise),
    lastChangeDate: addDays(b.data.check_in, -HOSTEL_POLICIES.modificationCutoffDays),
  };
}

export type { Quote };

// ---------------------------------------------------------------- PMS feed

/**
 * Room types, their beds and rooms, and the free count per night for the next PMS_FEED_DAYS
 * nights, worked out exactly as /book does (sheet, console blocks, OTA holds, website bookings
 * and live checkout holds). Hostel POS pulls this on each sync (pmsFeed.ts).
 */
export async function pmsFeed(d: EngineDeps): Promise<import('./pmsFeed').PmsFeed> {
  const { feedRoomTypes, PMS_FEED_DAYS, PMS_FEED_VERSION } = await import('./pmsFeed');
  const from = todayInIndia(d.now);
  const to = addDays(from, PMS_FEED_DAYS);
  const loads = await loadLoads(d, from, to).catch(() => ({ confirmed: [], holds: [] } as Loads));
  const sheet = await loadSheetAvailability(d).catch(() => ({} as SheetAvailability));
  const closures = await loadClosures(d, sheet).catch(() => [] as ClosureRow[]);
  const free: Record<string, Record<IsoDate, number>> = {};
  for (const room of BOOKING_ROOM_TYPES) {
    const nights = freeUnitsPerNight({
      roomTypeId: room.id, checkIn: from, checkOut: to,
      capacity: (night) => freeAfterClosures(closures, room.id, night, sheetCapacity(sheet, room.id, night, room.units)),
      confirmed: loads.confirmed, holds: loads.holds, blockedNights: new Set(), now: d.now,
    });
    free[room.id] = Object.fromEntries(nights.map((n) => [n.night, n.free]));
  }
  return { version: PMS_FEED_VERSION, source: 'xtsy.one', generatedAt: d.now.toISOString(), from, days: PMS_FEED_DAYS, roomTypes: feedRoomTypes(), free };
}
