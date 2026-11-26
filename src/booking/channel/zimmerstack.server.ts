/**
 * ZimmerStack channel manager (https://docs.zimmerstack.com), partner model: one XTSY company key
 * (ZIMMERSTACK_CONNECT_KEY, a Lovable Cloud secret) reaches every XTSY property; each property has
 * its own on/off switch in the console and nothing is sent for it while it is off.
 *
 * Rules from ZimmerStack's AGENTS.md that this file keeps:
 * - The key stays on the server; it is never logged, returned or stored.
 * - Writes happen only on a person's action: an admin's button, an edit saved in the Google Sheet or
 *   a console block. Only nights whose count changed are sent. Nothing writes on a timer.
 * - The package paces and retries by itself; no retry loops here.
 * - The webhook is a nudge; the event log is the truth. The receiver verifies the signature on the
 *   raw body, then reads the log from the saved place, so a missed or repeated delivery changes nothing.
 * - Every write's notices, rejections and roundings are returned to the person who pressed the button.
 * Server only.
 */
import {
  ZimmerStack, ZimmerStackError, ZimmerStackWebhookError, checkKey, isIncidentEvent, isOtaBookingEvent, isSupportTicketEvent, isSyncEvent,
  noticesOf, verifyWebhook,
} from '@zimmerstack/connect';
import { addDays, stayNights, todayInIndia, type IsoDate } from '../dates';
import { closureFromRow, freeAfterClosures, type ClosureRow } from '../consoleClosures';
import { sheetCapacity, type SheetAvailability } from '../sheetAvailability';
import { findRoomType } from '../catalogue';
import { channelNotConnected, type ChannelManager, type ChannelReservation } from './channelManager';
import {
  CAMP_ID, HORIZON_NIGHTS, HOSTEL_ID, changedCounts, channelProperty, isChannelPropertyId, otaHolds, paiseToRupeeString,
  sheetSnapshotFor, toRanges, type ChannelPropertyId, type CountCell, type OtaBookingRow,
} from './zimmerstackPlan';
import { CAMP_TENTS } from '@/data/shnonpedengCamp';

type Db = any;
export interface ZsDeps {
  db: Db;
  env: Record<string, string | undefined>;
  now: Date;
  /** Tests only: a stand-in for the API. */
  fetch?: typeof fetch;
}

export class ChannelError extends Error {}

/** "test" or "live" for a well-formed key (checked offline, never sent or shown), else null. */
export function keyMode(key: string | undefined): 'test' | 'live' | null {
  const c = checkKey(key);
  return c.ok ? c.mode : null;
}

/** One client per key and process, so its pacing is shared (ZimmerStack: "one instance per process"). */
let shared: { key: string; client: ZimmerStack } | null = null;
export function zsClient(d: Pick<ZsDeps, 'env' | 'fetch'>): ZimmerStack | null {
  const key = d.env.ZIMMERSTACK_CONNECT_KEY;
  if (!keyMode(key)) return null;
  if (d.fetch) return new ZimmerStack({ apiKey: key, fetch: d.fetch });
  if (!shared || shared.key !== key) shared = { key: key!, client: new ZimmerStack({ apiKey: key }) };
  return shared.client;
}

export interface PropertyRow {
  id: ChannelPropertyId;
  name: string;
  enabled: boolean;
  zs_property_id: number | null;
  zs_mode: 'test' | 'live' | null;
  zs_live: boolean;
  event_place: number;
  last_event_at: string | null;
}

/** A person-readable message for anything the API refused; never contains the key. */
export function explain(e: unknown): string {
  if (e instanceof ZimmerStackError) return `${e.message}${e.retryAfterSeconds ? ` Try again in about ${Math.ceil(e.retryAfterSeconds / 60)} min.` : ''}`;
  if (e instanceof ChannelError) return e.message;
  return 'ZimmerStack could not be reached. Please try again.';
}

async function audit(d: ZsDeps, action: string, details: Record<string, unknown>) {
  await d.db.from('be_audit_log').insert({ action: `channel.${action}`, details });
}

async function log(d: ZsDeps, row: { booking_id?: string | null; direction: string; message_type: string; status: string; detail?: string }) {
  await d.db.from('be_channel_log').insert({ booking_id: row.booking_id ?? null, direction: row.direction, message_type: row.message_type, status: row.status, detail: row.detail?.slice(0, 500) ?? null });
}

export async function loadProperty(d: ZsDeps, id: ChannelPropertyId): Promise<PropertyRow | null> {
  const r = await d.db.from('be_channel_properties').select('*').eq('id', id).maybeSingle();
  return (r.data as PropertyRow | null) ?? null;
}

/** The property is on, the key works, and it is linked to a ZimmerStack hotel made with this key type. */
function linked(row: PropertyRow | null, mode: 'test' | 'live' | null): row is PropertyRow & { zs_property_id: number } {
  return !!row && row.enabled && !!mode && row.zs_mode === mode && typeof row.zs_property_id === 'number';
}

async function roomMap(d: ZsDeps, id: ChannelPropertyId, mode: 'test' | 'live') {
  const r = await d.db.from('be_channel_room_map').select('room_type_id,zs_room_type_id,zs_rate_plan_id').eq('property_id', id).eq('zs_mode', mode);
  return new Map<string, { roomTypeId: number; ratePlanId: number | null }>((r.data ?? []).map((x: any) => [x.room_type_id, { roomTypeId: Number(x.zs_room_type_id), ratePlanId: x.zs_rate_plan_id === null ? null : Number(x.zs_rate_plan_id) }]));
}

/** A property ready for writes, or the reason it is not. */
async function ready(d: ZsDeps, id: ChannelPropertyId) {
  const zs = zsClient(d);
  const mode = keyMode(d.env.ZIMMERSTACK_CONNECT_KEY);
  const row = await loadProperty(d, id);
  if (!zs || !mode) return { ok: false as const, reason: 'The ZimmerStack key is not saved in Lovable Cloud secrets yet (ZIMMERSTACK_CONNECT_KEY).' };
  if (!row) return { ok: false as const, reason: 'The channel tables are not set up yet (database update 0030).' };
  if (!row.enabled) return { ok: false as const, reason: `${row.name} is switched off for the channel manager.` };
  if (!linked(row, mode)) return { ok: false as const, reason: `${row.name} is not linked to a ZimmerStack hotel for this ${mode} key yet.` };
  return { ok: true as const, zs, hotel: zs.forProperty(row.zs_property_id), mode, row };
}

// ------------------------------------------------------------------ status for the console

export async function channelOverview(d: ZsDeps) {
  const mode = keyMode(d.env.ZIMMERSTACK_CONNECT_KEY);
  const props = await d.db.from('be_channel_properties').select('*').order('created_at');
  if (props.error) return { dbReady: false as const, keyMode: mode, webhookSecretSet: !!d.env.ZIMMERSTACK_WEBHOOK_SECRET, properties: [] };
  const maps = await d.db.from('be_channel_room_map').select('property_id,room_type_id,zs_mode,zs_rate_plan_id');
  const upcoming = await d.db.from('be_ota_bookings').select('property_id,status').gte('check_out', todayInIndia(d.now));
  return {
    dbReady: true as const,
    keyMode: mode,
    webhookSecretSet: !!d.env.ZIMMERSTACK_WEBHOOK_SECRET,
    properties: ((props.data ?? []) as PropertyRow[]).filter((p) => isChannelPropertyId(p.id)).map((p) => {
      const spec = channelProperty(p.id);
      const mapped = (maps.data ?? []).filter((m: any) => m.property_id === p.id && m.zs_mode === mode && m.zs_rate_plan_id !== null).length;
      return {
        id: p.id, name: p.name, enabled: p.enabled,
        linked: linked(p, mode), zsPropertyId: p.zs_mode === mode ? p.zs_property_id : null, otherModeLinked: !!p.zs_mode && p.zs_mode !== mode,
        live: p.zs_live, roomTypes: spec.roomTypes.length, mapped,
        lastEventAt: p.last_event_at,
        upcomingOtaBookings: (upcoming.data ?? []).filter((b: any) => b.property_id === p.id && b.status === 'CONFIRMED').length,
      };
    }),
  };
}

export async function setEnabled(d: ZsDeps, id: ChannelPropertyId, on: boolean) {
  const r = await d.db.from('be_channel_properties').update({ enabled: on, updated_at: d.now.toISOString() }).eq('id', id).select('id');
  if (r.error || !r.data?.length) throw new ChannelError('Could not change the switch. Has database update 0030 run?');
  await audit(d, on ? 'property.on' : 'property.off', { id });
  return { ok: true, on };
}

/** Which hotels the key reaches and how much of each budget is left. Reads only. */
export async function testConnection(d: ZsDeps) {
  const zs = zsClient(d);
  if (!zs) return { ok: false, message: 'The ZimmerStack key is not saved in Lovable Cloud secrets yet (ZIMMERSTACK_CONNECT_KEY).' };
  try {
    const list = await zs.properties.list();
    const mode = keyMode(d.env.ZIMMERSTACK_CONNECT_KEY);
    return { ok: true, message: `Connected with a ${mode} ${list.keyKind} key. It reaches ${list.properties.length} hotel(s).`, hotels: list.properties.map((p) => ({ id: p.id, name: p.name, sandbox: p.sandbox })) };
  } catch (e) {
    return { ok: false, message: explain(e) };
  }
}

// ------------------------------------------------------------------ setting up a hotel (admin's buttons)

async function saveMap(d: ZsDeps, id: ChannelPropertyId, mode: 'test' | 'live', hotel: ZimmerStack) {
  const spec = channelProperty(id);
  const catalog = await hotel.catalog.get();
  const rows: Record<string, unknown>[] = [];
  const missingPlans: string[] = [];
  for (const rt of spec.roomTypes) {
    const z = catalog.roomTypes.find((x) => x.ref === rt.ref);
    if (!z) continue;
    // Our own room-only plan by ref, else the room-only plan the hotel was born with.
    const plan = catalog.ratePlans.find((p) => p.ref === rt.planRef) ?? catalog.ratePlans.find((p) => p.roomTypeId === z.id);
    if (!plan) missingPlans.push(rt.ref);
    rows.push({ property_id: id, room_type_id: rt.ref, zs_mode: mode, zs_room_type_id: z.id, zs_rate_plan_id: plan?.id ?? null, updated_at: d.now.toISOString() });
  }
  if (rows.length) await d.db.from('be_channel_room_map').upsert(rows);
  return { mapped: rows.length, missingPlans };
}

export interface HotelOwner { name: string; email: string; phone: string }

/** Adds the property to ZimmerStack as a new hotel (billed monthly by ZimmerStack once live). */
export async function addHotel(d: ZsDeps, id: ChannelPropertyId, owner: HotelOwner) {
  const zs = zsClient(d);
  const mode = keyMode(d.env.ZIMMERSTACK_CONNECT_KEY);
  const row = await loadProperty(d, id);
  if (!zs || !mode) throw new ChannelError('The ZimmerStack key is not saved in Lovable Cloud secrets yet (ZIMMERSTACK_CONNECT_KEY).');
  if (!row?.enabled) throw new ChannelError('Switch this property on first.');
  if (row.zs_mode === mode && row.zs_property_id) throw new ChannelError(`${row.name} is already linked to ZimmerStack hotel ${row.zs_property_id}.`);
  const spec = channelProperty(id);
  try {
    const made = await zs.properties.create({
      name: spec.name, owner, address: spec.address, currency: 'INR', timezone: 'Asia/Kolkata',
      roomTypes: spec.roomTypes.map((r) => ({ ref: r.ref, name: r.name, roomCount: r.roomCount, adults: r.adults, defaultRate: r.rate })),
    });
    // A hotel XTSY adds is live from the start: XTSY's booking engine is its source of truth.
    await d.db.from('be_channel_properties').update({ zs_property_id: made.id, zs_mode: mode, zs_live: true, event_place: 0, updated_at: d.now.toISOString() }).eq('id', id);
    const map = await saveMap(d, id, mode, zs.forProperty(made.id));
    await audit(d, 'hotel.add', { id, zsPropertyId: made.id, mode, sandbox: made.sandbox });
    return { ok: true, zsPropertyId: made.id, billing: made.billing.message, channelManager: made.channelManager, ...map };
  } catch (e) {
    throw new ChannelError(explain(e));
  }
}

/** Links the property to a hotel the key already reaches (e.g. one made in the partner portal). */
export async function linkHotel(d: ZsDeps, id: ChannelPropertyId, zsPropertyId: number) {
  const zs = zsClient(d);
  const mode = keyMode(d.env.ZIMMERSTACK_CONNECT_KEY);
  const row = await loadProperty(d, id);
  if (!zs || !mode) throw new ChannelError('The ZimmerStack key is not saved in Lovable Cloud secrets yet (ZIMMERSTACK_CONNECT_KEY).');
  if (!row?.enabled) throw new ChannelError('Switch this property on first.');
  try {
    const list = await zs.properties.list();
    const hotel = list.properties.find((p) => p.id === zsPropertyId);
    if (!hotel) throw new ChannelError(`This key does not reach ZimmerStack hotel ${zsPropertyId}.`);
    const readiness = await zs.forProperty(zsPropertyId).readiness.get();
    await d.db.from('be_channel_properties').update({ zs_property_id: zsPropertyId, zs_mode: mode, zs_live: readiness.live, event_place: 0, updated_at: d.now.toISOString() }).eq('id', id);
    await audit(d, 'hotel.link', { id, zsPropertyId, mode });
    return { ok: true, live: readiness.live };
  } catch (e) {
    throw e instanceof ChannelError ? e : new ChannelError(explain(e));
  }
}

/** Sends the property's room types and room-only rate plans (by XTSY's refs), then records ZimmerStack's ids. */
export async function sendCatalog(d: ZsDeps, id: ChannelPropertyId) {
  const r = await ready(d, id);
  if (!r.ok) throw new ChannelError(r.reason);
  const spec = channelProperty(id);
  try {
    const rts = await r.hotel.catalog.upsertRoomTypes({ roomTypes: spec.roomTypes.map((x) => ({ ref: x.ref, name: x.name, roomCount: x.roomCount, adults: x.adults })) });
    const catalog = await r.hotel.catalog.get();
    const needPlans = spec.roomTypes.filter((x) => {
      const z = catalog.roomTypes.find((c) => c.ref === x.ref);
      return z && !catalog.ratePlans.some((p) => p.ref === x.planRef || p.roomTypeId === z.id);
    });
    let plans = null;
    if (needPlans.length) {
      plans = await r.hotel.catalog.upsertRatePlans({ ratePlans: needPlans.map((x) => ({ ref: x.planRef, roomTypeRef: x.ref, name: x.planName, mealPlan: 'EP' as const, defaultRate: x.rate })) });
    }
    const map = await saveMap(d, id, r.mode, r.hotel);
    await audit(d, 'catalog.send', { id, roomTypes: rts.items.length, ratePlans: plans?.items.length ?? 0 });
    return {
      ok: true, ...map,
      channelManager: rts.channelManager,
      notices: [...rts.items, ...(plans?.items ?? [])].map((i) => i.notice).filter(Boolean) as string[],
      rounded: [...(rts.rounded ?? []), ...(plans?.rounded ?? [])],
    };
  } catch (e) {
    throw e instanceof ChannelError ? e : new ChannelError(explain(e));
  }
}

function writeReport(answers: Awaited<ReturnType<ZimmerStack['rates']['set']>>) {
  return {
    accepted: answers.reduce((s, a) => s + a.acceptedCells, 0),
    unchanged: answers.reduce((s, a) => s + a.noopCells, 0),
    rejected: answers.flatMap((a) => a.rejected.map((x) => `${x.cells} night(s): ${x.error}`)),
    rounded: answers.flatMap((a) => a.rounded ?? []).map((x) => `${x.field}: sent ${x.sent}, kept ${x.kept}`),
    warnings: [...answers.flatMap((a) => (a.priceWarnings ?? []).map((w) => w.message)), ...answers.flatMap((a) => (a.warnings ?? []).map((w) => w.message))],
    notices: noticesOf(answers).map((n) => ({ level: n.level, message: n.message, action: n.action })),
    batches: answers.map((a) => a.batchId),
  };
}

/** Sends the catalogue price of every room-only plan for the next year (until Stage 2 pricing control). */
export async function sendPrices(d: ZsDeps, id: ChannelPropertyId) {
  const r = await ready(d, id);
  if (!r.ok) throw new ChannelError(r.reason);
  const map = await roomMap(d, id, r.mode);
  const from = todayInIndia(d.now);
  const to = addDays(from, HORIZON_NIGHTS - 1);
  const updates = channelProperty(id).roomTypes.flatMap((x) => {
    const m = map.get(x.ref);
    return m?.ratePlanId ? [{ ratePlanId: m.ratePlanId, dateFrom: from, dateTo: to, rate: x.rate, currency: 'INR' }] : [];
  });
  if (!updates.length) throw new ChannelError('Send the room types first, so every room has its rate plan.');
  try {
    const answers = await r.hotel.rates.set(updates, r.row.zs_live ? undefined : { beforeGoLive: true });
    await audit(d, 'prices.send', { id, plans: updates.length, from, to });
    return { ok: true, ...writeReport(answers) };
  } catch (e) {
    throw new ChannelError(explain(e));
  }
}

export async function readiness(d: ZsDeps, id: ChannelPropertyId) {
  const r = await ready(d, id);
  if (!r.ok) throw new ChannelError(r.reason);
  try {
    const x = await r.hotel.readiness.get();
    if (x.live !== r.row.zs_live) await d.db.from('be_channel_properties').update({ zs_live: x.live }).eq('id', id);
    return { live: x.live, ready: x.ready, checks: x.checks.map((c) => ({ id: c.id, passed: c.passed, summary: c.summary, action: c.action })) };
  } catch (e) {
    throw new ChannelError(explain(e));
  }
}

/** Makes XTSY the hotel's source of truth (only on the admin's click), then sends the room counts. */
export async function goLive(d: ZsDeps, id: ChannelPropertyId) {
  const r = await ready(d, id);
  if (!r.ok) throw new ChannelError(r.reason);
  try {
    const res = await r.hotel.readiness.goLive();
    await d.db.from('be_channel_properties').update({ zs_live: true, updated_at: d.now.toISOString() }).eq('id', id);
    await audit(d, 'hotel.go_live', { id, replay: res.replay });
    const counts = await sendAllCounts(d, id);
    return { ok: true, next: res.next, counts };
  } catch (e) {
    throw e instanceof ChannelError ? e : new ChannelError(explain(e));
  }
}

/** One-time link the property's own person opens to connect an OTA (live key only). */
export async function connectLink(d: ZsDeps, id: ChannelPropertyId, channel: 'bookingcom' | 'gommt' | 'agoda' | 'expedia' | 'tripcom' | 'yatra' | 'hostelworld' | 'airbnb') {
  const r = await ready(d, id);
  if (!r.ok) throw new ChannelError(r.reason);
  if (r.mode !== 'live') throw new ChannelError('Connecting an OTA needs the live key (zsk_live_…). The sandbox has no real OTAs.');
  try {
    const made = await r.zs.connectLinks.create({ propertyId: r.row.zs_property_id, channel, expiresInHours: 72 });
    await audit(d, 'ota.connect_link', { id, channel, linkId: made.link.id });
    return { url: made.url, hotelStep: made.hotelStep, expiresAt: made.link.expiresAt };
  } catch (e) {
    throw new ChannelError(explain(e));
  }
}

// ------------------------------------------------------------------ room counts

async function currentSheet(d: ZsDeps): Promise<SheetAvailability> {
  const { loadSheetAvailability } = await import('../publicEngine.core');
  return loadSheetAvailability({ db: d.db, env: d.env, now: d.now });
}

async function closuresWithHolds(d: ZsDeps, sheet: SheetAvailability): Promise<ClosureRow[]> {
  const today = todayInIndia(d.now);
  const c = await d.db.from('console_inventory_overrides').select('*').gte('end_date', today);
  const rows = ((c.data ?? []) as Record<string, unknown>[]).map(closureFromRow).filter((x): x is ClosureRow => x !== null);
  return [...rows, ...otaHolds(await loadOtaBookings(d), sheet, today)];
}

/** Confirmed website bookings per room type and night (they are not in the sheet until the owner adds them). */
async function websiteLoads(d: ZsDeps, from: IsoDate, to: IsoDate) {
  const b = await d.db.from('be_bookings').select('check_in,check_out,be_booking_lines(room_type_id,units)').in('status', ['confirmed', 'checked_in']).lt('check_in', to).gt('check_out', from);
  const out = new Map<string, number>();
  for (const row of b.data ?? []) for (const line of row.be_booking_lines ?? []) for (const night of stayNights(row.check_in, row.check_out)) {
    const k = `${line.room_type_id}|${night}`;
    out.set(k, (out.get(k) ?? 0) + Number(line.units));
  }
  return out;
}

/** What /book shows free for these nights: the same count the OTAs should sell. */
export async function freeCounts(d: ZsDeps, id: ChannelPropertyId, nights: { roomTypeId: string; night: IsoDate }[]): Promise<CountCell[]> {
  if (!nights.length) return [];
  const sheet = id === HOSTEL_ID ? await currentSheet(d) : {};
  const closures = await closuresWithHolds(d, sheet);
  const sorted = nights.map((n) => n.night).sort();
  const loads = id === HOSTEL_ID ? await websiteLoads(d, sorted[0], addDays(sorted[sorted.length - 1], 1)) : new Map<string, number>();
  return nights.map(({ roomTypeId, night }) => {
    const capacity = id === CAMP_ID ? CAMP_TENTS : sheetCapacity(sheet, roomTypeId, night, findRoomType(roomTypeId)?.units ?? 0);
    const free = Math.max(0, freeAfterClosures(closures, roomTypeId, night, capacity) - (loads.get(`${roomTypeId}|${night}`) ?? 0));
    return { roomTypeId, night, available: free };
  });
}

/**
 * Sends the counts of these nights, but only those that differ from what was last sent.
 * Called after a sheet edit, a console block or opening, and going live. Never on a timer.
 */
export async function pushCounts(d: ZsDeps, id: ChannelPropertyId, nights: { roomTypeId: string; night: IsoDate }[], reason: string) {
  const r = await ready(d, id);
  if (!r.ok) return { sent: 0, skipped: r.reason };
  const today = todayInIndia(d.now);
  const last = addDays(today, HORIZON_NIGHTS - 1);
  const known = new Set(channelProperty(id).roomTypes.map((x) => x.ref));
  const wanted = nights.filter((n) => known.has(n.roomTypeId) && n.night >= today && n.night <= last);
  if (!wanted.length) return { sent: 0 };
  const cells = await freeCounts(d, id, wanted);
  const sentRows = await d.db.from('be_channel_sent_counts').select('room_type_id,night,available').eq('property_id', id).gte('night', today);
  const sent = new Map<string, number>(((sentRows.data ?? []) as any[]).map((x) => [`${x.room_type_id}|${String(x.night).slice(0, 10)}`, Number(x.available)]));
  const changed = changedCounts(cells, sent);
  if (!changed.length) return { sent: 0 };
  try {
    const answers = await r.hotel.availability.set(toRanges(changed));
    const report = writeReport(answers);
    if (report.rejected.length === 0) {
      await d.db.from('be_channel_sent_counts').upsert(changed.map((c) => ({ property_id: id, room_type_id: c.roomTypeId, night: c.night, available: c.available, sent_at: d.now.toISOString() })));
    }
    await log(d, { direction: 'out', message_type: `counts:${reason}`, status: report.rejected.length ? 'failed' : 'ok', detail: `${changed.length} night(s)${report.rejected.length ? `; refused: ${report.rejected.join('; ')}` : ''}` });
    return { sent: changed.length, ...report };
  } catch (e) {
    await log(d, { direction: 'out', message_type: `counts:${reason}`, status: 'failed', detail: explain(e) });
    return { sent: 0, error: explain(e) };
  }
}

/** Every night of the year ahead for every room type (going live, or the admin's "Send room counts"). */
export async function sendAllCounts(d: ZsDeps, id: ChannelPropertyId) {
  const today = todayInIndia(d.now);
  const nights = channelProperty(id).roomTypes.flatMap((x) => Array.from({ length: HORIZON_NIGHTS }, (_, i) => ({ roomTypeId: x.ref, night: addDays(today, i) })));
  return pushCounts(d, id, nights, 'all');
}

/** After the Google Sheet publishes: send the hostel nights whose sheet count changed. */
export async function afterSheetPublish(d: ZsDeps, changed: { roomTypeId: string; night: IsoDate }[]) {
  return pushCounts(d, HOSTEL_ID, changed, 'sheet');
}

/** After a console block or opening (rooms as console or engine ids; dates inclusive). */
export async function afterClosureChange(d: ZsDeps, rooms: { propertyId: string; unitTypeId: string }[], start: IsoDate, end: IsoDate) {
  const { ENGINE_ROOM_ID } = await import('@/data/publicRates');
  const out: Record<string, Awaited<ReturnType<typeof pushCounts>>> = {};
  for (const id of [HOSTEL_ID, CAMP_ID] as const) {
    const ids = rooms.filter((r) => (r.propertyId === 'XTSY-SHL-SUITE' ? HOSTEL_ID : r.propertyId) === id).map((r) => ENGINE_ROOM_ID[r.unitTypeId] ?? r.unitTypeId);
    if (!ids.length) continue;
    const nights = ids.flatMap((roomTypeId) => stayNights(start, addDays(end, 1)).map((night) => ({ roomTypeId, night })));
    out[id] = await pushCounts(d, id, nights, 'console');
  }
  return out;
}

// ------------------------------------------------------------------ website bookings out

export function zimmerstackChannel(d: ZsDeps, status: { connected: boolean; unmapped: string[] }): ChannelManager {
  if (!status.connected) return channelNotConnected(status.unmapped, 'ZimmerStack is not connected for XTSY Travellers Hostel.');
  return {
    id: 'zimmerstack',
    connected: true,
    unmapped: status.unmapped,
    pushReservation: (res) => pushWebsiteBooking(d, res),
  };
}

/** Whether the hostel is switched on, linked and has every room type mapped. */
export async function hostelChannelStatus(d: ZsDeps): Promise<{ connected: boolean; unmapped: string[] }> {
  const all = channelProperty(HOSTEL_ID).roomTypes.map((r) => r.ref);
  const mode = keyMode(d.env.ZIMMERSTACK_CONNECT_KEY);
  if (!mode || !d.db) return { connected: false, unmapped: all };
  const row = await loadProperty(d, HOSTEL_ID).catch(() => null);
  if (!linked(row, mode)) return { connected: false, unmapped: all };
  const map = await roomMap(d, HOSTEL_ID, mode);
  const unmapped = all.filter((ref) => !map.get(ref)?.ratePlanId);
  return { connected: row.zs_live, unmapped };
}

async function pushWebsiteBooking(d: ZsDeps, res: ChannelReservation) {
  const r = await ready(d, HOSTEL_ID);
  if (!r.ok) return { acknowledged: false, detail: r.reason };
  if (res.status !== 'confirmed') return { acknowledged: false, detail: 'Changes and cancellations of website bookings are made by the desk in ZimmerStack for now.' };
  const map = await roomMap(d, HOSTEL_ID, r.mode);
  const rooms = res.rooms.flatMap((line) => {
    const m = map.get(line.roomTypeId);
    if (!m) return [];
    const perUnit = Math.max(1, Math.ceil(line.guests / Math.max(1, line.units)));
    const nightly = line.nightlyRates[0] ?? 0;
    return Array.from({ length: line.units }, () => ({ roomTypeId: m.roomTypeId, ...(m.ratePlanId ? { ratePlanId: m.ratePlanId } : {}), adults: perUnit, nightlyRate: paiseToRupeeString(nightly) }));
  });
  if (!rooms.length) return { acknowledged: false, detail: 'No room in this booking is linked to ZimmerStack yet.' };
  try {
    const made = await r.hotel.bookings.create({
      externalReference: res.reference, checkIn: res.checkIn, checkOut: res.checkOut, currency: 'INR',
      guest: { name: res.guestName, phone: res.guestPhone ?? '', ...(res.guestEmail ? { email: res.guestEmail } : {}) },
      rooms, nightlyRateIncludesTaxes: false,
      ...(res.paid > 0 ? { payment: { amount: paiseToRupeeString(res.paid), method: 'ONLINE' as const } } : {}),
      notes: 'Booked on xtsy.one',
    });
    return { acknowledged: true, channelId: made.reference };
  } catch (e) {
    return { acknowledged: false, detail: explain(e) };
  }
}

// ------------------------------------------------------------------ OTA bookings in

export async function loadOtaBookings(d: Pick<ZsDeps, 'db' | 'now'>): Promise<OtaBookingRow[]> {
  const r = await d.db.from('be_ota_bookings').select('status,check_in,check_out,rooms,sheet_at_arrival,received_at').gte('check_out', todayInIndia(d.now));
  if (r.error) return [];
  return ((r.data ?? []) as any[]).map((x) => ({ ...x, check_in: String(x.check_in).slice(0, 10), check_out: String(x.check_out).slice(0, 10) }));
}

type Booking = { id: number; version?: number; status: 'CONFIRMED' | 'CANCELLED'; channel: { otaName: string; otaReservationCode: string }; stay: { checkIn: string; checkOut: string };
  guest: { fullName: string; phone?: string | null; email?: string | null; contactWithheld?: string }; occupancy: { adults: number; children: number };
  rooms: { roomTypeId: number; status: string }[]; amounts: { currency: string; total: number } };

/** Saves one OTA booking (newer versions only) and keeps the sheet counts seen when it first arrived. */
export async function applyOtaBooking(d: ZsDeps, propertyId: ChannelPropertyId, mode: 'test' | 'live', b: Booking) {
  const map = await roomMap(d, propertyId, mode);
  const byZsId = new Map([...map].map(([ref, m]) => [m.roomTypeId, ref]));
  const units = new Map<string, number>();
  for (const room of b.rooms) {
    if (room.status === 'CANCELLED') continue;
    const ref = byZsId.get(room.roomTypeId);
    if (ref) units.set(ref, (units.get(ref) ?? 0) + 1);
  }
  const rooms = [...units].map(([roomTypeId, n]) => ({ roomTypeId, units: n }));
  const existing = await d.db.from('be_ota_bookings').select('version,sheet_at_arrival,received_at').eq('zs_mode', mode).eq('zs_booking_id', b.id).maybeSingle();
  const version = b.version ?? 1;
  if (existing.data && Number(existing.data.version) >= version) return { applied: false };
  const sheetAtArrival = existing.data?.sheet_at_arrival && Object.keys(existing.data.sheet_at_arrival).length
    ? existing.data.sheet_at_arrival
    : propertyId === HOSTEL_ID ? sheetSnapshotFor(rooms, b.stay.checkIn, b.stay.checkOut, await currentSheet(d)) : {};
  await d.db.from('be_ota_bookings').upsert({
    zs_booking_id: b.id, zs_mode: mode, property_id: propertyId, version, status: b.status,
    ota_name: b.channel.otaName, ota_code: b.channel.otaReservationCode, check_in: b.stay.checkIn, check_out: b.stay.checkOut,
    // Contact is copied now: ZimmerStack withholds it 30 days after checkout.
    guest_name: b.guest.fullName, guest_phone: b.guest.phone ?? null, guest_email: b.guest.email ?? null, contact_withheld: b.guest.contactWithheld ?? null,
    adults: b.occupancy.adults, children: b.occupancy.children, total: b.amounts.total, currency: b.amounts.currency,
    rooms, sheet_at_arrival: sheetAtArrival, received_at: existing.data?.received_at ?? d.now.toISOString(), updated_at: d.now.toISOString(),
  });
  return { applied: true };
}

/** Reads the hotel's event log from the saved place and applies it. Safe to run any number of times. */
export async function catchUp(d: ZsDeps, id: ChannelPropertyId) {
  const r = await ready(d, id);
  if (!r.ok) return { applied: 0, skipped: r.reason };
  let place = Number(r.row.event_place ?? 0);
  let applied = 0;
  let gap = false;
  try {
    for await (const event of r.hotel.events.all({ after: place }, { onGap: () => { gap = true; } })) {
      if (isOtaBookingEvent(event as never)) {
        const res = await applyOtaBooking(d, id, r.mode, (event as any).data.booking);
        if (res.applied) applied++;
      } else if (isSyncEvent(event as never)) {
        await log(d, { direction: 'in', message_type: (event as any).type, status: (event as any).type.endsWith('recovered') ? 'ok' : 'failed', detail: JSON.stringify((event as any).data?.sync ?? {}).slice(0, 400) });
      }
      place = (event as any).sequence;
      await d.db.from('be_channel_properties').update({ event_place: place, last_event_at: d.now.toISOString() }).eq('id', id);
    }
    if (gap) {
      // The log no longer holds what follows our place (or this is the first read): reload recent OTA bookings.
      for await (const b of r.hotel.channelBookings.all({ since: addDays(todayInIndia(d.now), -90) }) as unknown as AsyncIterable<Booking>) {
        if ((await applyOtaBooking(d, id, r.mode, b)).applied) applied++;
      }
    }
    return { applied, place };
  } catch (e) {
    await log(d, { direction: 'in', message_type: 'events', status: 'failed', detail: explain(e) });
    return { applied, place, error: explain(e) };
  }
}

/**
 * POST /api/public/hooks/zimmerstack. Verifies the signature on the raw body (secret in
 * ZIMMERSTACK_WEBHOOK_SECRET), answers 400 to anything unverified, then catches up from the log.
 */
export async function handleZimmerstackWebhook(request: Request, d: Omit<ZsDeps, 'db'> & { db: Db | null }): Promise<Response> {
  const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };
  const secret = d.env.ZIMMERSTACK_WEBHOOK_SECRET;
  if (!secret) return new Response('not configured', { status: 503, headers });
  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > 1_000_000) return new Response('too large', { status: 413, headers });
  const raw = await request.text();
  if (raw.length > 1_000_000) return new Response('too large', { status: 413, headers });
  let event: any;
  try {
    event = await verifyWebhook(raw, request.headers, secret);
  } catch (e) {
    return new Response(e instanceof ZimmerStackWebhookError ? e.reason : 'bad_body', { status: 400, headers });
  }
  // Account-level events carry no hotel: check them before reading event.property.
  if (isIncidentEvent(event) || isSupportTicketEvent(event) || !event.property?.id || !d.db) return new Response('ok', { status: 200, headers });
  const prop = await d.db.from('be_channel_properties').select('id').eq('zs_property_id', event.property.id).eq('zs_mode', event.mode).maybeSingle();
  const id = prop.data?.id;
  if (id && isChannelPropertyId(id)) await catchUp({ ...d, db: d.db }, id);
  return new Response('ok', { status: 200, headers });
}

