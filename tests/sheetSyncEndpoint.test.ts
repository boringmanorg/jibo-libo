import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

/** Tiny in-memory stand-in for the few PostgREST calls the sheet endpoints make. */
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
const published: { version: number; rows: Row[] }[] = [];
/** Columns the database does not have yet (a migration still to run). */
const missingColumns = new Set<string>();
function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let mode: 'select' | 'update' | 'delete' = 'select';
  let patch: Row = {};
  let head = false;
  let cols = '';
  const rows = () => (tables[table] ??= []).filter((r) => filters.every((f) => f(r)));
  const q: any = {
    select: (c?: string, o?: { head?: boolean }) => { head = !!o?.head; cols = c ?? ''; return q; },
    eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q; },
    lt: (k: string, v: string) => { filters.push((r) => r[k] < v); return q; },
    gte: (k: string, v: string) => { filters.push((r) => r[k] >= v); return q; },
    update: (p: Row) => { mode = 'update'; patch = p; return q; },
    delete: () => { mode = 'delete'; return q; },
    insert: async (r: Row) => { (tables[table] ??= []).push({ id: `id-${(tables[table] ?? []).length}`, created_at: new Date().toISOString(), status: 'pending', ...r }); return { error: null }; },
    maybeSingle: async () => (cols.split(',').some((c) => missingColumns.has(c.trim()))
      ? { data: null, error: { code: '42703', message: 'column does not exist' } }
      : { data: rows()[0] ?? null, error: null }),
    then: (res: (v: unknown) => void) => {
      if (mode === 'update') { rows().forEach((r) => Object.assign(r, patch)); return res({ error: null }); }
      if (mode === 'delete') { const keep = (tables[table] ?? []).filter((r) => !filters.every((f) => f(r))); tables[table] = keep; return res({ error: null }); }
      const found = rows();
      return res({ data: head ? null : found, count: found.length, error: null });
    },
  };
  return q;
}
vi.mock('@/admin/serviceClient.server', () => ({
  getServiceClient: () => ({ from: query, rpc: async (_fn: string, a: { p_version: number; p_rows: Row[] }) => { published.push({ version: a.p_version, rows: a.p_rows }); return { data: a.p_rows.length, error: null }; } }),
}));

const { handleSheetAvailability, handleSheetPair, minuteVersion } = await import('@/booking/sheetSync.server');
const post = (path: string, body: unknown, auth?: string, ip = '203.0.113.7') => new Request(`https://x/api/public/hooks/${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(auth ? { authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body),
});
const cells = { from: '2026-11-21', cells: [{ roomNo: '2', night: '2027-02-02', free: 7 }, { roomNo: '3', night: '2027-02-02', free: 7 }, { roomNo: '99', night: '2027-02-02', free: 4 }] };

describe('Google Sheet sync: passwordless pairing approved in the console', () => {
  beforeEach(() => { for (const k of Object.keys(tables)) delete tables[k]; published.length = 0; missingColumns.clear(); });

  it('still publishes the counts before the write-back migration has run', async () => {
    const pair = await (await handleSheetPair(post('sheet-pair', { label: 'S' }))).json();
    tables.be_sheet_links[0].status = 'active';
    missingColumns.add('writes_since');
    const res = await handleSheetAvailability(post('sheet-availability', cells, pair.token), Date.UTC(2026, 10, 26, 17, 41));
    expect(res.status).toBe(200);
    expect(published).toHaveLength(1);
  });

  it('a sheet asks to connect and gets a token and code; its numbers are refused until approved', async () => {
    const pair = await (await handleSheetPair(post('sheet-pair', { label: 'Room Management' }))).json();
    expect(pair.code).toMatch(/^\d{4}-\d{4}$/);
    expect(tables.be_sheet_links[0].token_hash).toBe(createHash('sha256').update(pair.token).digest('hex'));
    expect(JSON.stringify(tables.be_sheet_links)).not.toContain(pair.token);
    expect((await handleSheetAvailability(post('sheet-availability', cells, pair.token))).status).toBe(403);
    tables.be_sheet_links[0].status = 'active';
    const ok = await handleSheetAvailability(post('sheet-availability', cells, pair.token), Date.UTC(2026, 10, 21, 4, 30, 20));
    expect(ok.status).toBe(200);
    expect((await ok.json()).unknownRooms).toEqual(['99']);
  });

  it('refuses unknown or revoked tokens, wrong content types and malformed bodies', async () => {
    expect((await handleSheetAvailability(post('sheet-availability', cells, 'x'.repeat(43)))).status).toBe(401);
    expect((await handleSheetAvailability(post('sheet-availability', cells))).status).toBe(401);
    const pair = await (await handleSheetPair(post('sheet-pair', { label: 'S' }))).json();
    tables.be_sheet_links[0].status = 'revoked';
    expect((await handleSheetAvailability(post('sheet-availability', cells, pair.token))).status).toBe(401);
    expect((await handleSheetPair(new Request('https://x', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hi' }))).status).toBe(415);
    expect((await handleSheetPair(post('sheet-pair', { label: 'S', extra: 1 }))).status).toBe(400);
  });

  it('limits pairing requests per visitor', async () => {
    for (let i = 0; i < 5; i++) expect((await handleSheetPair(post('sheet-pair', { label: `S${i}` }, undefined, '198.51.100.1'))).status).toBe(200);
    expect((await handleSheetPair(post('sheet-pair', { label: 'S6' }, undefined, '198.51.100.1'))).status).toBe(429);
  });

  it('publishes each sync as the next minute’s snapshot, summed per room type; never publishes an empty send', async () => {
    const pair = await (await handleSheetPair(post('sheet-pair', { label: 'S' }))).json();
    tables.be_sheet_links[0].status = 'active';
    const t = Date.UTC(2026, 10, 21, 4, 30, 59);
    const res = await (await handleSheetAvailability(post('sheet-availability', cells, pair.token), t)).json();
    expect(published[0]).toEqual({ version: minuteVersion(t), rows: [{ room_type_id: 'bed-in-6-bed-standard-dormitory', night: '2027-02-02', free: 14 }] });
    expect(res.visibleFrom).toBe('2026-11-21T04:30:00.000Z');
    expect((await handleSheetAvailability(post('sheet-availability', { from: '2026-11-21', cells: [] }, pair.token))).status).toBe(422);
    expect(published).toHaveLength(1);
  });
});
