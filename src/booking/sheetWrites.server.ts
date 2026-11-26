/**
 * Google Sheet write-back: the queue the sheet's script works through. Server only.
 *
 * - A new, changed or cancelled OTA booking, and a confirmed, re-dated or cancelled website booking,
 *   queue a request here (only once the paired sheet runs the write-back script).
 * - The sheet's script collects the open requests with its token, writes them into the Room
 *   Management tab (lowest-numbered room that fits the whole group; split only if none does), then
 *   sends the new counts together with what it wrote. The counts are published first and the
 *   requests marked written after, so for a moment a booking may be counted twice as taken, never
 *   twice as free.
 * - A changed booking cancels what was written and writes it again; a request not yet written is
 *   simply replaced.
 */
import type { IsoDate } from './dates';
import { stayNights, todayInIndia } from './dates';
import {
  WEBSITE_TAG, cleanGuestName, forScript, otaRoomGuests, otaTag, sameStay, writableRooms,
  type PlacedCell, type SheetWant, type SheetWriteForScript,
} from './sheetWritePlan';

type Db = any;
export type SheetWriteState = 'queued' | 'applied' | null;

interface WriteRow {
  id: number; source: 'ota' | 'website'; source_ref: string; kind: 'book' | 'cancel'; cancels: number | null;
  tag: string; guest_name: string; check_in: string; check_out: string; rooms: SheetWant['rooms'];
  status: 'pending' | 'applied' | 'superseded'; placed: PlacedCell[] | null; problem: string | null;
}

const day = (v: string) => String(v).slice(0, 10) as IsoDate;

/** True once the paired sheet has asked for write requests (it runs the write-back script). */
export async function writesEnabled(db: Db): Promise<boolean> {
  const r = await db.from('be_sheet_links').select('id').eq('status', 'active').not('writes_since', 'is', null).limit(1);
  return !r.error && (r.data ?? []).length > 0;
}

export interface WriteBackDeps {
  db: Db;
  env: Record<string, string | undefined>;
  now: Date;
  /** Tests only: the integration checks' answers. */
  integrations?: { channel: boolean; pms: boolean; payment: boolean };
}

/**
 * Owner, 26 Nov 2026: bookings are written into the sheet only once the channel manager, the PMS
 * and online payment are all connected and working. Until then nothing is queued and the owner keeps
 * the sheet by hand as today (OTA bookings stay held on /book until the owner edits those nights).
 * - Channel manager: ZimmerStack live for the hostel with every room type linked.
 * - PMS: switched on in the console (Settings) with the posbyxtsy.club address and key saved.
 * - Payment: the Zoho Payments keys saved (website bookings are queued only after a successful payment).
 * - The sheet runs the write-back script.
 */
export async function writeBackGate(d: WriteBackDeps): Promise<{ ready: boolean; missing: string[] }> {
  let checks = d.integrations;
  if (!checks) {
    const { hostelChannelStatus } = await import('./channel/zimmerstack.server');
    const { zohoConfigFromEnv } = await import('./payments/zoho.server');
    const ch = await hostelChannelStatus({ db: d.db, env: d.env, now: d.now }).catch(() => ({ connected: false, unmapped: ['?'] }));
    const pms = await d.db.from('console_integration_settings').select('pms_enabled').eq('id', 1).maybeSingle();
    checks = {
      channel: ch.connected && ch.unmapped.length === 0,
      pms: !pms.error && pms.data?.pms_enabled === true && !!d.env.XTSY_SAAS_API_URL && !!d.env.XTSY_SAAS_API_KEY,
      payment: zohoConfigFromEnv(d.env) !== null,
    };
  }
  const missing: string[] = [];
  if (!checks.channel) missing.push('Channel manager (ZimmerStack) live for the hostel');
  if (!checks.pms) missing.push('PMS connected (posbyxtsy.club)');
  if (!checks.payment) missing.push('Online payment (Zoho Payments) connected');
  if (!(await writesEnabled(d.db))) missing.push('The new script running in the Google Sheet');
  return { ready: missing.length === 0, missing };
}

/** The book request that currently stands for this booking (not cancelled, not replaced). */
function standing(rows: WriteRow[]): WriteRow | null {
  const cancelled = new Set(rows.filter((r) => r.kind === 'cancel' && r.status !== 'superseded').map((r) => Number(r.cancels)));
  const books = rows.filter((r) => r.kind === 'book' && r.status !== 'superseded' && !cancelled.has(Number(r.id)));
  return books.length ? books[books.length - 1] : null;
}

/**
 * Makes the queue match what the sheet should hold for one booking. Returns where it stands:
 * 'applied' (the sheet already holds it), 'queued' (waiting for the sheet) or null (nothing to hold:
 * write-back is off, or the booking is cancelled).
 */
export async function reconcileSheetWrites(d: WriteBackDeps, source: 'ota' | 'website', ref: string, want: SheetWant | null): Promise<SheetWriteState> {
  const db = d.db;
  const existing = await db.from('be_sheet_writes').select('*').eq('source', source).eq('source_ref', ref).order('id', { ascending: true });
  if (existing.error) return null;
  const rows = (existing.data ?? []) as WriteRow[];
  const rooms = want ? writableRooms(want.rooms) : [];
  const target = want && rooms.length ? { ...want, rooms } : null;
  // Not written before: start only once every integration is live. A booking already written is
  // always followed (changed or cancelled), even if an integration is switched off later.
  if (!rows.length && (!target || !(await writeBackGate(d)).ready)) return null;
  const live = standing(rows);
  if (live && target && sameStay({ checkIn: day(live.check_in), checkOut: day(live.check_out), rooms: live.rooms }, target)) {
    return live.status === 'applied' ? 'applied' : 'queued';
  }
  if (live) {
    // Not written yet: drop it. If the sheet wrote it in the meantime, cancel what it wrote.
    const drop = live.status === 'pending'
      ? await db.from('be_sheet_writes').update({ status: 'superseded' }).eq('id', live.id).eq('status', 'pending').select('id')
      : { data: [] };
    if (!(drop.data ?? []).length) {
      await db.from('be_sheet_writes').insert({
        source, source_ref: ref, kind: 'cancel', cancels: live.id, tag: live.tag, guest_name: live.guest_name,
        check_in: live.check_in, check_out: live.check_out, rooms: live.rooms,
      });
    }
  }
  if (!target) return null;
  const ins = await db.from('be_sheet_writes').insert({
    source, source_ref: ref, kind: 'book', tag: target.tag, guest_name: cleanGuestName(target.guestName),
    check_in: target.checkIn, check_out: target.checkOut, rooms: target.rooms,
  });
  return ins.error ? null : 'queued';
}

/** After an OTA booking is saved: queue it for the sheet (hostel only) and note where it stands. */
export async function queueOtaBooking(d: WriteBackDeps, mode: 'test' | 'live', zsBookingId: number) {
  const db = d.db;
  const r = await db.from('be_ota_bookings').select('property_id,status,ota_name,ota_code,check_in,check_out,guest_name,adults,children,rooms').eq('zs_mode', mode).eq('zs_booking_id', zsBookingId).maybeSingle();
  const b = r.data;
  if (!b || b.property_id !== 'XTSY-SHL-HOSTEL') return null;
  const want: SheetWant | null = b.status === 'CONFIRMED'
    ? { checkIn: day(b.check_in), checkOut: day(b.check_out), rooms: otaRoomGuests(b.rooms ?? [], Number(b.adults ?? 0), Number(b.children ?? 0)), guestName: b.guest_name ?? '', tag: otaTag(b.ota_name, b.ota_code) }
    : null;
  const state = await reconcileSheetWrites(d, 'ota', `${mode}:${zsBookingId}`, want);
  await db.from('be_ota_bookings').update({ sheet_write: state }).eq('zs_mode', mode).eq('zs_booking_id', zsBookingId);
  return state;
}

const LIVE = ['confirmed', 'checked_in'];

/**
 * After a website booking's payment succeeds (and when it is later re-dated or cancelled): queue it
 * for the sheet, tagged XTSY. A booking that was never paid is never written.
 */
export async function queueWebsiteBooking(d: WriteBackDeps, bookingId: string) {
  const db = d.db;
  const r = await db.from('be_bookings').select('reference,status,check_in,check_out,guest_name,be_booking_lines(room_type_id,units,guests)').eq('id', bookingId).maybeSingle();
  const b = r.data;
  if (!b) return null;
  const want: SheetWant | null = LIVE.includes(b.status)
    ? { checkIn: day(b.check_in), checkOut: day(b.check_out), rooms: (b.be_booking_lines ?? []).map((l: any) => ({ roomTypeId: l.room_type_id, units: Number(l.units), guests: Number(l.guests) })), guestName: b.guest_name ?? '', tag: WEBSITE_TAG }
    : null;
  const state = await reconcileSheetWrites(d, 'website', b.reference, want);
  await db.from('be_bookings').update({ sheet_write: state }).eq('id', bookingId);
  return state;
}

/** Open requests for the sheet's script, oldest first. */
export async function pendingForSheet(db: Db, limit = 50): Promise<SheetWriteForScript[]> {
  const r = await db.from('be_sheet_writes').select('*').eq('status', 'pending').order('id', { ascending: true }).limit(limit);
  if (r.error) return [];
  const rows = (r.data ?? []) as WriteRow[];
  const cancelOf = rows.filter((x) => x.kind === 'cancel').map((x) => Number(x.cancels));
  const placed = new Map<number, PlacedCell[]>();
  if (cancelOf.length) {
    const p = await db.from('be_sheet_writes').select('id,placed').in('id', cancelOf);
    for (const x of p.data ?? []) placed.set(Number(x.id), x.placed ?? []);
  }
  return rows.map((x) => forScript(x, x.kind === 'cancel' ? placed.get(Number(x.cancels)) : undefined));
}

export interface SheetAck { id: number; placed: PlacedCell[]; problem?: string }

/**
 * The sheet wrote these requests (sent with the counts that include them, after those counts were
 * published). Marks them written, and stops counting their bookings separately.
 * `waiting` are requests the sheet could not write yet (e.g. their month is not in the sheet).
 */
export async function recordSheetAcks(db: Db, applied: SheetAck[], waiting: { id: number; problem: string }[], now: Date) {
  const done: number[] = [];
  for (const a of applied) {
    const r = await db.from('be_sheet_writes').select('*').eq('id', a.id).maybeSingle();
    const w = r.data as WriteRow | null;
    if (!w) continue;
    done.push(Number(a.id));
    if (w.status === 'applied') continue; // already recorded
    if (w.status === 'superseded') {
      // Replaced while the sheet was writing it: give back what it wrote.
      if (w.kind === 'book' && a.placed.length) {
        await db.from('be_sheet_writes').update({ placed: a.placed, problem: a.problem ?? null, applied_at: now.toISOString() }).eq('id', w.id);
        await db.from('be_sheet_writes').insert({ source: w.source, source_ref: w.source_ref, kind: 'cancel', cancels: w.id, tag: w.tag, guest_name: w.guest_name, check_in: w.check_in, check_out: w.check_out, rooms: w.rooms });
      }
      continue;
    }
    await db.from('be_sheet_writes').update({ status: 'applied', placed: a.placed, problem: a.problem ?? null, applied_at: now.toISOString() }).eq('id', w.id).eq('status', 'pending');
    if (w.kind !== 'book') continue;
    const all = await db.from('be_sheet_writes').select('*').eq('source', w.source).eq('source_ref', w.source_ref).order('id', { ascending: true });
    const live = standing(((all.data ?? []) as WriteRow[]).map((x) => (Number(x.id) === Number(w.id) ? { ...x, status: 'applied' as const } : x)));
    if (!live || Number(live.id) !== Number(w.id)) continue;
    if (w.source === 'ota') {
      const [mode, id] = w.source_ref.split(':');
      await db.from('be_ota_bookings').update({ sheet_write: 'applied' }).eq('zs_mode', mode).eq('zs_booking_id', Number(id)).eq('status', 'CONFIRMED');
    } else {
      await db.from('be_bookings').update({ sheet_write: 'applied' }).eq('reference', w.source_ref).in('status', LIVE);
    }
  }
  for (const w of waiting) {
    await db.from('be_sheet_writes').update({ problem: w.problem.slice(0, 300) }).eq('id', w.id).eq('status', 'pending');
  }
  return done;
}

/** For the console: requests with a problem, and requests the sheet has not picked up for 10 minutes. */
export async function sheetWriteIssues(d: WriteBackDeps) {
  const { db, now } = d;
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const r = await db.from('be_sheet_writes').select('id,source,source_ref,kind,tag,guest_name,check_in,check_out,status,problem,created_at,applied_at')
    .gte('created_at', since).order('id', { ascending: false }).limit(200);
  if (r.error) return { enabled: false, missing: [] as string[], rows: [] as any[] };
  const stale = now.getTime() - 10 * 60_000;
  const today = todayInIndia(now);
  const rows = ((r.data ?? []) as any[]).filter((x) =>
    day(x.check_out) >= today && (x.problem || (x.status === 'pending' && new Date(x.created_at).getTime() < stale)));
  const gate = await writeBackGate(d);
  return { enabled: gate.ready, missing: gate.missing, rows: rows.map((x) => ({ ...x, nights: stayNights(day(x.check_in), day(x.check_out)).length })) };
}
