/**
 * Google Sheet → website availability. Server only.
 *
 * Who may send: no shared password. The sheet's script asks to connect (POST
 * /api/public/hooks/sheet-pair) and receives a random token plus a short pairing code; the owner
 * approves that code in the console. Only approved sheets' tokens (stored as SHA-256 hashes) are
 * accepted. Pair requests are rate-limited per visitor and capped overall, and expire after 30 min.
 *
 * When it shows: each sync is published atomically as the NEXT minute's snapshot, so every guest
 * switches to it at the same moment (the start of that minute). Until then, everyone — including
 * new and returning visitors — sees the last published snapshot.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import { aggregateSheet } from './sheetAvailability';

const MAX_BODY_BYTES = 1_000_000;
const PAIR_TTL_MS = 30 * 60_000;
const PAIRS_PER_VISITOR_PER_HOUR = 5;
const MAX_PENDING_PAIRS = 10;

export const minuteVersion = (ms: number) => Math.floor(ms / 60_000);
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const headers = { 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });

const body = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cells: z.array(z.object({
    roomNo: z.string().trim().min(1).max(10),
    night: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    free: z.number().int().min(0).max(50),
  })).max(20000),
  // Write-back script only: the requests it wrote into the sheet before reading these counts.
  applied: z.array(z.object({
    id: z.number().int().positive(),
    placed: z.array(z.object({
      roomNo: z.string().trim().min(1).max(10),
      night: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      units: z.number().int().min(0).max(50),
      note: z.string().max(200),
    })).max(2000),
    problem: z.string().max(300).optional(),
  })).max(200).optional(),
  // ...and the ones it could not write yet, with the reason.
  waiting: z.array(z.object({ id: z.number().int().positive(), problem: z.string().max(300) })).max(200).optional(),
}).strict();

async function readJson(request: Request): Promise<unknown | Response> {
  if (!/^application\/json\b/i.test(request.headers.get('content-type') ?? '')) return json({ error: 'Send application/json' }, 415);
  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > MAX_BODY_BYTES) return json({ error: 'Too large' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'Too large' }, 413);
  try { return JSON.parse(text); } catch { return json({ error: 'Not JSON' }, 400); }
}

const visitor = (request: Request) =>
  sha256(`${request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'unknown'}|${new Date().toISOString().slice(0, 10)}|sheet`).slice(0, 32);

async function db() {
  const { getServiceClient } = await import('@/admin/serviceClient.server');
  return getServiceClient();
}

/** The approved sheet behind this request's token, or the response to send instead. */
async function approvedSheet(request: Request): Promise<{ client: any; link: { id: string; writes_since: string | null } } | Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return json({ error: 'Unauthorized' }, 401);
  const client = await db();
  if (!client) return json({ error: 'Database unavailable' }, 503);
  const find = async (cols: string): Promise<{ data: any; error: unknown }> => client.from('be_sheet_links').select(cols).eq('token_hash', sha256(token)).maybeSingle();
  let link = await find('id,status,writes_since');
  // Before the write-back migration (0031) runs, writes_since does not exist yet: the counts must
  // still get through, with write-back simply off.
  if (link.error) link = await find('id,status');
  if (link.error) return json({ error: 'Database unavailable' }, 503);
  if (link.data) link.data.writes_since ??= null;
  if (!link.data || link.data.status === 'revoked') return json({ error: 'Unauthorized' }, 401);
  if (link.data.status !== 'active') return json({ status: 'waiting-for-approval', detail: 'Approve this sheet’s pairing code in the XTSY console (Stays).' }, 403);
  return { client, link: link.data };
}

/** POST /api/public/hooks/sheet-availability — an approved sheet publishes its numbers. */
export async function handleSheetAvailability(request: Request, now = Date.now()): Promise<Response> {
  const auth = await approvedSheet(request);
  if (auth instanceof Response) return auth;
  const { client, link } = auth;

  const raw = await readJson(request);
  if (raw instanceof Response) return raw;
  const parsed = body.safeParse(raw);
  if (!parsed.success) return json({ error: 'Expected { from, cells: [{ roomNo, night, free }] }' }, 400);

  const { availability, unknownRooms } = aggregateSheet(parsed.data.cells as never);
  const { applied = [], waiting = [] } = parsed.data;
  const rows = Object.entries(availability).flatMap(([room_type_id, nights]) =>
    Object.entries(nights).filter(([night]) => night >= parsed.data.from).map(([night, free]) => ({ room_type_id, night, free })));
  // An empty send is more likely a broken sheet layout than a hostel with no rooms: never publish it.
  if (rows.length === 0) return json({ status: 'nothing-to-publish', unknownRooms, acked: [] }, 422);

  const version = minuteVersion(now); // readable immediately; no next-minute staging
  const pub = await client.rpc('be_sheet_publish', { p_version: version, p_rows: rows });
  if (pub.error) return json({ error: 'Could not publish availability' }, 500);
  // These counts already include what the script just wrote: from now on those bookings are counted
  // by the sheet alone. Recorded after publishing, so a booking is never counted twice as free.
  const { recordSheetAcks } = await import('./sheetWrites.server');
  const acked = applied.length || waiting.length ? await recordSheetAcks(client, applied as never, waiting, new Date(now)) : [];
  await client.from('be_sheet_links').update({ last_sync_at: new Date(now).toISOString(), last_sync_rows: rows.length }).eq('id', link.id);
  // The owner edited the sheet: send the hostel nights whose count changed to the channel manager
  // (ZimmerStack), when it is switched on. Never blocks or fails the sheet's own sync.
  const channel = await sendChangedNights(client, version, rows, parsed.data.from, now).catch(() => null);
  return json({ status: 'ok', saved: rows.length, unknownRooms, visibleFrom: new Date(version * 60_000).toISOString(), acked, ...(channel ? { channel } : {}) });
}

/** The previous published snapshot vs this one; the changed hostel nights go to ZimmerStack. */
async function sendChangedNights(client: any, version: number, rows: { room_type_id: string; night: string; free: number }[], from: string, now: number) {
  const prevV = await client.from('be_sheet_availability').select('version').lt('version', version).order('version', { ascending: false }).limit(1);
  const prevVersion = prevV.data?.[0]?.version;
  if (prevVersion === undefined) return null; // first sync: going live sends every night instead
  const prev: Record<string, Record<string, number>> = {};
  for (let page = 0; page < 20; page++) {
    const r = await client.from('be_sheet_availability').select('room_type_id,night,free').eq('version', prevVersion).gte('night', from).order('night').order('room_type_id').range(page * 1000, page * 1000 + 999);
    if (r.error) return null;
    for (const x of r.data ?? []) (prev[x.room_type_id] ??= {})[String(x.night).slice(0, 10)] = x.free;
    if ((r.data ?? []).length < 1000) break;
  }
  const next: Record<string, Record<string, number>> = {};
  for (const x of rows) (next[x.room_type_id] ??= {})[x.night] = x.free;
  const { changedSheetNights } = await import('./channel/zimmerstackPlan');
  const changed = changedSheetNights(prev, next).filter((c) => c.night >= from);
  if (!changed.length) return { sent: 0 };
  const { afterSheetPublish } = await import('./channel/zimmerstack.server');
  const res = await afterSheetPublish({ db: client, env: process.env, now: new Date(now) }, changed);
  return { sent: res.sent, ...('skipped' in res && res.skipped ? { skipped: res.skipped } : {}) };
}

/**
 * POST /api/public/hooks/sheet-writes — the approved sheet collects the OTA and website bookings to
 * write into the Room Management tab. The first call switches write-back on for that sheet: from
 * then on new bookings are queued for it (and no longer need typing by hand).
 */
export async function handleSheetWrites(request: Request, now = Date.now()): Promise<Response> {
  const auth = await approvedSheet(request);
  if (auth instanceof Response) return auth;
  const { client, link } = auth;
  if (!link.writes_since) await client.from('be_sheet_links').update({ writes_since: new Date(now).toISOString() }).eq('id', link.id);
  const { pendingForSheet } = await import('./sheetWrites.server');
  return json({ status: 'ok', writes: await pendingForSheet(client) });
}

/** POST /api/public/hooks/sheet-pair — a sheet asks to connect; returns its token and pairing code. */
export async function handleSheetPair(request: Request, now = Date.now()): Promise<Response> {
  const raw = await readJson(request);
  if (raw instanceof Response) return raw;
  const parsed = z.object({ label: z.string().trim().min(1).max(80) }).strict().safeParse(raw);
  if (!parsed.success) return json({ error: 'Expected { label }' }, 400);
  const client = await db();
  if (!client) return json({ error: 'Database unavailable' }, 503);

  const requester = visitor(request);
  const cutoff = new Date(now - PAIR_TTL_MS).toISOString();
  // Expired requests are kept for the owner's review; they simply stop counting toward the pending cap.
  const mine = await client.from('be_sheet_links').select('id', { count: 'exact', head: true })
    .eq('requester_hash', requester).gte('created_at', new Date(now - 3600_000).toISOString());
  if ((mine.count ?? 0) >= PAIRS_PER_VISITOR_PER_HOUR) return json({ error: 'Too many requests; try again in an hour.' }, 429);
  const pending = await client.from('be_sheet_links').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('created_at', cutoff);
  if ((pending.count ?? 0) >= MAX_PENDING_PAIRS) return json({ error: 'Too many pending requests; ask the console admin to clear them.' }, 429);

  const token = randomBytes(32).toString('base64url');
  const code = `${randomInt(1000, 10000)}-${randomInt(1000, 10000)}`;
  const { error } = await client.from('be_sheet_links').insert({ token_hash: sha256(token), pair_code: code, label: parsed.data.label, requester_hash: requester });
  if (error) return json({ error: 'Could not start pairing' }, 500);
  return json({ status: 'pending', code, token, expiresAt: new Date(now + PAIR_TTL_MS).toISOString() });
}
