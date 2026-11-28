import { describe, expect, it } from 'vitest';
import {
  checkoutProblems,
  engineStatus,
  handlePaymentWebhook,
  newReference,
  publicBooking,
  searchStays,
  startCheckout,
  validateDates,
  type CheckoutInput,
  type EngineDeps,
} from '../src/booking/publicEngine.core';
import type { PaymentGateway, SessionState } from '../src/booking/payments/gateway';
import type { ChannelManager } from '../src/booking/channel/channelManager';

// ---- a small in-memory stand-in for the Supabase query builder --------------------------
type Row = Record<string, any>;
function fakeDb(seed: Record<string, Row[]> = {}) {
  const t: Record<string, Row[]> = { be_guests: [], be_settings: [], be_room_mapping: [], be_bookings: [], be_booking_lines: [], be_holds: [], be_payments: [], be_webhook_events: [], be_invoices: [], be_channel_log: [], ...seed };
  let idn = 0;
  const unique: Record<string, string> = { be_webhook_events: 'key', be_bookings: 'reference' };
  function q(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: any;
    let cols = '*';
    let single: 'one' | 'maybe' | null = null;
    let limit = Infinity;
    const api: any = {
      select(c = '*') { if (op === 'select') cols = c; else cols = c; return api; },
      insert(p: any) { op = 'insert'; payload = p; return api; },
      update(p: any) { op = 'update'; payload = p; return api; },
      delete() { op = 'delete'; return api; },
      upsert(p: any) { op = 'insert'; payload = p; return api; },
      eq(k: string, v: any) { filters.push((r) => r[k] === v); return api; },
      in(k: string, v: any[]) { filters.push((r) => v.includes(r[k])); return api; },
      lt(k: string, v: any) { filters.push((r) => r[k] < v); return api; },
      gt(k: string, v: any) { filters.push((r) => r[k] > v); return api; },
      gte(k: string, v: any) { filters.push((r) => r[k] >= v); return api; },
      order() { return api; },
      limit(n: number) { limit = n; return api; },
      single() { single = 'one'; return api; },
      maybeSingle() { single = 'maybe'; return api; },
      then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); },
    };
    function shape(r: Row) {
      const out = { ...r };
      if (cols.includes('be_booking_lines(')) out.be_booking_lines = t.be_booking_lines.filter((l) => l.booking_id === r.id);
      return out;
    }
    function run() {
      const rows = t[table] ?? (t[table] = []);
      if (op === 'insert') {
        const list = (Array.isArray(payload) ? payload : [payload]).map((p) => ({ id: `id${++idn}`, created_at: '2026-11-20T06:00:00.000Z', ...p }));
        const u = unique[table];
        if (u && list.some((p) => rows.some((r) => r[u] === p[u]))) return { data: null, error: { code: '23505', message: 'duplicate' } };
        rows.push(...list);
        return { data: single ? list[0] : list, error: null };
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') { hit.forEach((r) => Object.assign(r, payload)); return { data: hit, error: null }; }
      if (op === 'delete') { t[table] = rows.filter((r) => !hit.includes(r)); return { data: hit, error: null }; }
      const data = hit.slice(0, limit).map(shape);
      if (single) return { data: data[0] ?? null, error: single === 'one' && !data[0] ? { message: 'no rows' } : null };
      return { data, error: null };
    }
    return api;
  }
  let seq = 0;
  return { t, from: q, rpc: async () => ({ data: ++seq, error: null }) };
}

const ALL_IDS = ['bed-in-8-bed-mixed-dormitory', 'bed-in-6-bed-standard-dormitory', 'bed-in-6-bed-mixed-dormitory', 'bed-in-4-bed-female-deluxe-dormitory', 'king-room-with-mountain-view', 'triple-room-with-mountain-view', 'experience-by-xtsy'];
const liveSeed = () => ({
  be_settings: [{ id: 1, engine_switched_on: true, hold_minutes: 15 }],
});

function fakeGateway(state: Partial<SessionState> = {}): PaymentGateway & { sessions: any[] } {
  const sessions: any[] = [];
  return {
    id: 'zoho', sessions,
    async createCheckout(req) { sessions.push(req); return { sessionId: `ps_${sessions.length}`, redirectUrl: `https://payments.zoho.in/hostedpages/x${sessions.length}` }; },
    async createPaymentLink() { throw new Error('unused'); },
    async getSession() { return { status: 'succeeded', paymentIds: ['pay_1'], amount: 1e9, ...state } as SessionState; },
    async verifyWebhook(body) { return body === 'good' ? { sessionId: 'ps_1' } : null; },
    async verifyReturn() { return true; },
  };
}
const connectedChannel = (): ChannelManager & { pushed: any[] } => {
  const pushed: any[] = [];
  return {
    id: 'zimmerstack', connected: true, unmapped: [], pushed,
    async pushReservation(r) { pushed.push(r); return { acknowledged: true, channelId: 'ZS-1' }; },
  };
};

const NOW = new Date('2026-11-20T06:00:00Z'); // 11:30 IST
const BOT_ENV = { TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'test-value' };
const humanFetch = async (_url: string, init?: RequestInit) => new Response(JSON.stringify({ success: String(init?.body).includes('response=human') }), { status: 200 });
const deps = (over: Partial<EngineDeps> = {}): EngineDeps => ({ db: fakeDb(), env: BOT_ENV, now: NOW, gateway: null, fetch: humanFetch, ...over });
const input = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({
  checkIn: '2026-12-01', checkOut: '2026-12-03',
  rooms: [{ roomTypeId: 'king-room-with-mountain-view', units: 1, guests: 2 }],
  breakfast: [], botToken: 'human', guest: { name: 'Test Guest', phone: '+91 98765 43210', email: 'guest@example.com', gender: 'male', nationality: 'India' }, method: 'upi', policyAccepted: true, ...over,
});

describe('dates', () => {
  it('refuses past, reversed, too long and too far stays', () => {
    expect(() => validateDates('2026-11-19', '2026-11-21', NOW)).toThrow(/past/);
    expect(() => validateDates('2026-12-02', '2026-12-01', NOW)).toThrow(/after check-in/);
    expect(() => validateDates('2026-12-01', '2027-01-15', NOW)).toThrow(/30 nights/);
    expect(() => validateDates('2028-01-01', '2028-01-02', NOW)).toThrow(/one year/);
    expect(validateDates('2026-11-20', '2026-11-21', NOW)).toEqual({ checkIn: '2026-11-20', checkOut: '2026-11-21' });
  });
});

describe('search', () => {
  it('previews every room type with catalogue prices and a 7-night strip while not live', async () => {
    const r = await searchStays(deps(), { checkIn: '2026-12-01', checkOut: '2026-12-02' });
    expect(r.live).toBe(false);
    expect(r.inventorySynced).toBe(false);
    expect(r.rooms).toHaveLength(7);
    expect(r.rooms[0].strip).toHaveLength(7);
    expect(r.fromRate).toBe(40000);
    const king = r.rooms.find((x) => x.id === 'king-room-with-mountain-view')!;
    expect(king).toMatchObject({ fromRate: 240000, freeForStay: 2, soldAs: 'room' });
  });

  it('counts confirmed bookings and live holds, not expired holds', async () => {
    const db = fakeDb({
      be_bookings: [{ id: 'b1', status: 'confirmed', check_in: '2026-12-01', check_out: '2026-12-02', channel_status: 'pending' }],
      be_booking_lines: [{ booking_id: 'b1', room_type_id: 'king-room-with-mountain-view', units: 1 }],
      be_holds: [
        { room_type_id: 'experience-by-xtsy', units: 1, nights: ['2026-12-01'], expires_at: '2026-11-20T06:10:00Z' },
        { room_type_id: 'triple-room-with-mountain-view', units: 1, nights: ['2026-12-01'], expires_at: '2026-11-20T05:00:00Z' },
      ],
    });
    const r = await searchStays(deps({ db }), { checkIn: '2026-12-01', checkOut: '2026-12-02' });
    const by = (id: string) => r.rooms.find((x) => x.id === id)!;
    expect(by('king-room-with-mountain-view').freeForStay).toBe(1);
    expect(by('experience-by-xtsy').freeForStay).toBe(0);
    expect(by('triple-room-with-mountain-view').freeForStay).toBe(1);
    expect(by('king-room-with-mountain-view').strip[1].free).toBe(2);
  });

  it('keeps the sheet counts once connected; an OTA booking from ZimmerStack holds its beds at once', async () => {
    const db = fakeDb({ be_ota_bookings: [{ status: 'CONFIRMED', check_in: '2026-12-01', check_out: '2026-12-03', rooms: [{ roomTypeId: 'bed-in-6-bed-mixed-dormitory', units: 2 }], sheet_at_arrival: {}, received_at: '2026-11-20T05:00:00Z' }] } as any);
    const r = await searchStays(deps({ db, channel: connectedChannel() }), { checkIn: '2026-12-01', checkOut: '2026-12-02' });
    expect(r.inventorySynced).toBe(true);
    expect(r.rooms.find((x) => x.id === 'bed-in-6-bed-mixed-dormitory')).toMatchObject({ freeForStay: 16, fromRate: 50000 });
    expect(r.rooms.find((x) => x.id === 'bed-in-8-bed-mixed-dormitory')).toMatchObject({ freeForStay: 8 });
  });
});

describe('checkout', () => {
  it('lists every problem before touching the database', () => {
    const p = checkoutProblems(input({
      policyAccepted: false, guest: { name: 'A', phone: '12', email: 'bad', gender: 'male', nationality: 'India' },
      rooms: [{ roomTypeId: 'bed-in-4-bed-female-deluxe-dormitory', units: 1, guests: 1 }, { roomTypeId: 'experience-by-xtsy', units: 1, guests: 2 }],
      breakfast: [{ item: 'caviar', qty: 1 }],
    }));
    expect(p.join(' ')).toMatch(/policy/);
    expect(p.join(' ')).toMatch(/Gender mismatch/);
    expect(p.join(' ')).toMatch(/valid email/);
    expect(p.join(' ')).toMatch(/sky view/);
    expect(p.join(' ')).toMatch(/breakfast item is not on the TAB Bistro menu/);
    expect(p.join(' ')).toMatch(/phone/);
    expect(p.join(' ')).toMatch(/full name/);
  });

  it('caps beds and rooms per online booking', () => {
    expect(checkoutProblems(input({ rooms: [{ roomTypeId: 'bed-in-6-bed-mixed-dormitory', units: 9, guests: 9 }] })).join(' ')).toMatch(/Up to 8 beds/);
  });

  it('is refused while the engine is not live', async () => {
    await expect(startCheckout(deps({ gateway: fakeGateway() }), input(), 'https://xtsy.one')).rejects.toThrow(/not open yet/);
  });

  it('creates a held booking, a hold and a 25% advance session when live', async () => {
    const db = fakeDb(liveSeed());
    const gateway = fakeGateway({ status: 'pending' });
    const d = deps({ db, gateway, channel: connectedChannel() });
    const r = await startCheckout(d, input(), 'https://xtsy.one');
    expect(r.reference).toMatch(/^XTSY-[A-Z0-9]{6}$/);
    expect(r.redirectUrl).toMatch(/payments\.zoho\.in/);
    const b = db.t.be_bookings[0];
    expect(b).toMatchObject({ status: 'held', guest_phone: '+919876543210', guests: 2 });
    // King room ₹2,400 × 2 nights = ₹4,800 + 5% GST = ₹5,040; advance 25% = ₹1,260
    expect(b.total_paise).toBe(504000);
    expect(b.advance_paise).toBe(126000);
    expect(db.t.be_holds).toHaveLength(1);
    expect(gateway.sessions[0]).toMatchObject({ amount: 126000, successUrl: `https://xtsy.one/book/confirmation?ref=${r.reference}` });
    expect(db.t.be_payments[0]).toMatchObject({ kind: 'advance', session_id: 'ps_1', amount_paise: 126000 });
  });

  it('allows another checkout for the same contact without revealing unpaid bookings, while retaining capacity checks', async () => {
    const db = fakeDb(liveSeed());
    const d = deps({ db, gateway: fakeGateway({ status: 'pending' }), channel: connectedChannel() });
    const first = await startCheckout(d, input(), 'https://xtsy.one');
    const second = await startCheckout(d, input(), 'https://xtsy.one');
    expect(second.reference).not.toBe(first.reference);
    expect(db.t.be_bookings).toHaveLength(2);
    await expect(startCheckout(d, input({ guest: { name: 'Third', phone: '+91 90000 00003', email: 't@example.com', gender: 'male', nationality: 'India' } }), 'https://xtsy.one')).rejects.toThrow(/no longer has 1 free/);
  });

  it('does not change checkout success based on an unrelated held booking for the supplied phone', async () => {
    for (const existing of [[], [{ id: 'private', guest_phone: '+919876543210', status: 'held', created_at: NOW.toISOString() }]]) {
      const db = fakeDb({ ...liveSeed(), be_bookings: existing });
      const result = await startCheckout(deps({ db, gateway: fakeGateway(), channel: connectedChannel() }), input(), 'https://xtsy.one');
      expect(result.redirectUrl).toBe('https://payments.zoho.in/hostedpages/x1');
      expect(db.t.be_holds).toHaveLength(1);
    }
  });
});

describe('payment confirmation', () => {
  async function paidBooking(state: Partial<SessionState> = {}) {
    const db = fakeDb(liveSeed());
    const channel = connectedChannel();
    const gateway = fakeGateway({ status: 'pending' });
    const d = deps({ db, gateway, channel });
    const { reference } = await startCheckout(d, input(), 'https://xtsy.one');
    const after = fakeGateway(state);
    return { db, channel, d: { ...d, gateway: after }, reference };
  }

  it('a verified webhook confirms once, issues an advance receipt and sends it to the channel manager', async () => {
    const { db, channel, d } = await paidBooking();
    expect(await handlePaymentWebhook(d, 'good', new Headers())).toEqual({ status: 200, body: 'ok' });
    expect(db.t.be_bookings[0]).toMatchObject({ status: 'confirmed', channel_status: 'synced', channel_id: 'ZS-1' });
    expect(db.t.be_holds).toHaveLength(0);
    expect(db.t.be_invoices[0].number).toMatch(/^XTSY\/2026-27\/AR\/0001$/);
    expect(channel.pushed).toHaveLength(1);
    expect(await handlePaymentWebhook(d, 'good', new Headers())).toEqual({ status: 200, body: 'duplicate' });
    expect(channel.pushed).toHaveLength(1);
  });

  it('ignores an unverified webhook', async () => {
    const { db, d } = await paidBooking();
    expect((await handlePaymentWebhook(d, 'forged', new Headers())).status).toBe(401);
    expect(db.t.be_bookings[0].status).toBe('held');
  });

  it('does not confirm when the gateway reports less than the advance', async () => {
    const { db, d } = await paidBooking({ amount: 100 });
    await handlePaymentWebhook(d, 'good', new Headers());
    expect(db.t.be_bookings[0].status).toBe('held');
  });

  it('a failed payment releases the hold', async () => {
    const { db, d } = await paidBooking({ status: 'failed' });
    await handlePaymentWebhook(d, 'good', new Headers());
    expect(db.t.be_bookings[0].status).toBe('expired');
    expect(db.t.be_holds).toHaveLength(0);
  });

  it('the confirmation page settles a late webhook and shows no personal data', async () => {
    const { d, reference } = await paidBooking();
    const pb = await publicBooking(d, reference);
    expect(pb).toMatchObject({ reference, status: 'confirmed', nights: 2, advance: 126000, balance: 378000, lastChangeDate: '2026-11-17' });
    expect(JSON.stringify(pb)).not.toMatch(/Test Guest|98765/);
    expect(await publicBooking(d, 'not-a-ref')).toBeNull();
  });
});

describe('guest checks', () => {
  it('a female lead guest can book one female-dorm bed; two need the others confirmed', () => {
    const female = { name: 'Asha', phone: '+91 98765 43210', email: 'a@example.com', gender: 'female' as const, nationality: 'India' };
    const one = [{ roomTypeId: 'bed-in-4-bed-female-deluxe-dormitory', units: 1, guests: 1 }];
    expect(checkoutProblems(input({ guest: female, rooms: one }))).toEqual([]);
    const two = [{ roomTypeId: 'bed-in-4-bed-female-deluxe-dormitory', units: 2, guests: 2 }];
    expect(checkoutProblems(input({ guest: female, rooms: two })).join(' ')).toMatch(/every guest/);
    expect(checkoutProblems(input({ guest: female, rooms: two, femaleOnlyAck: true }))).toEqual([]);
  });

  it('records the lead guest and flags Form C for foreign nationals', async () => {
    const db = fakeDb(liveSeed());
    const d = deps({ db, gateway: fakeGateway({ status: 'pending' }), channel: connectedChannel() });
    await startCheckout(d, input({ guest: { name: 'Lena', phone: '+49 1512 3456789', email: 'l@example.com', gender: 'female', nationality: 'Germany' } }), 'https://xtsy.one');
    expect(db.t.be_guests[0]).toMatchObject({ full_name: 'Lena', gender: 'female', nationality: 'Germany', form_c_status: 'due' });
    await startCheckout(d, input({ guest: { name: 'Ravi', phone: '+91 90000 11111', email: 'r@example.com', gender: 'male', nationality: 'India' }, rooms: [{ roomTypeId: 'triple-room-with-mountain-view', units: 1, guests: 3 }] }), 'https://xtsy.one');
    expect(db.t.be_guests[1].form_c_status).toBe('not_required');
  });
});

describe('bot check', () => {
  it('checkout is refused without a passed Turnstile check', async () => {
    const d = deps({ db: fakeDb(liveSeed()), gateway: fakeGateway({ status: 'pending' }), channel: connectedChannel() });
    await expect(startCheckout(d, input({ botToken: 'bot' }), 'https://xtsy.one')).rejects.toThrow(/human/);
    await expect(startCheckout(d, input({ botToken: undefined }), 'https://xtsy.one')).rejects.toThrow(/human/);
    await expect(startCheckout({ ...d, env: {} }, input(), 'https://xtsy.one')).rejects.toThrow(/not open yet|human/);
  });
  it('without Turnstile keys the engine cannot go live', async () => {
    expect(await engineStatus(deps({ db: fakeDb(liveSeed()), gateway: fakeGateway(), channel: connectedChannel(), env: {} }))).toEqual({ live: false });
  });
});

describe('misc', () => {
  it('references avoid look-alike characters', () => {
    const r = newReference(() => new Uint8Array([0, 8, 14, 30, 31, 61]));
    expect(r).toMatch(/^XTSY-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
  });
  it('engine status is off without a database', async () => {
    expect(await engineStatus(deps({ db: null }))).toEqual({ live: false });
  });
});
