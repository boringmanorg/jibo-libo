import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  CAMP_ID, HOSTEL_ID, changedCounts, changedSheetNights, channelProperty, otaHolds, paiseToRupeeString, toRanges,
} from '@/booking/channel/zimmerstackPlan';
import {
  addHotel, catchUp, handleZimmerstackWebhook, hostelChannelStatus, keyMode, pushCounts, zimmerstackChannel,
} from '@/booking/channel/zimmerstack.server';

// Well-formed sandbox credential built at run time (never a real one).
const SANDBOX = ['zsk', 'test', 'Ab1'.repeat(14) + 'x'].join('_');
const API = 'https://api.zimmerstack.com/api/v1/connect-api/v1';
const NOW = new Date('2026-11-26T06:00:00Z'); // 11:30 IST

type Row = Record<string, any>;
/** In-memory stand-in for the few Supabase calls used here. */
function fakeDb(seed: Record<string, Row[]> = {}) {
  const t: Record<string, Row[]> = { be_channel_properties: [], be_channel_room_map: [], be_channel_sent_counts: [], be_ota_bookings: [], be_audit_log: [], be_channel_log: [], be_sheet_availability: [], console_inventory_overrides: [], be_bookings: [], ...seed };
  const keys: Record<string, string[]> = {
    be_channel_room_map: ['property_id', 'room_type_id', 'zs_mode'], be_channel_sent_counts: ['property_id', 'room_type_id', 'night'], be_ota_bookings: ['zs_mode', 'zs_booking_id'],
  };
  function from(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'insert' | 'update' | 'upsert' = 'select';
    let payload: any;
    let one = false;
    const q: any = {
      select: () => q, order: () => q, limit: () => q, range: () => q, in: (c: string, v: any[]) => (filters.push((r) => v.includes(r[c])), q),
      eq: (c: string, v: any) => (filters.push((r) => r[c] === v), q),
      gte: (c: string, v: any) => (filters.push((r) => String(r[c]) >= String(v)), q),
      lte: (c: string, v: any) => (filters.push((r) => String(r[c]) <= String(v)), q),
      lt: (c: string, v: any) => (filters.push((r) => r[c] < v), q),
      gt: (c: string, v: any) => (filters.push((r) => r[c] > v), q),
      insert: (p: any) => ((op = 'insert'), (payload = p), q),
      update: (p: any) => ((op = 'update'), (payload = p), q),
      upsert: (p: any) => ((op = 'upsert'), (payload = p), q),
      maybeSingle: () => ((one = true), q),
      then: (res: (v: any) => void) => {
        const rows = (t[table] ??= []);
        if (op === 'insert') { rows.push(...[payload].flat()); return res({ data: null, error: null }); }
        if (op === 'upsert') {
          for (const p of [payload].flat()) {
            const k = keys[table] ?? ['id'];
            const at = rows.findIndex((r) => k.every((c) => r[c] === p[c]));
            if (at >= 0) rows[at] = { ...rows[at], ...p }; else rows.push({ ...p });
          }
          return res({ data: null, error: null });
        }
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        if (op === 'update') { hit.forEach((r) => Object.assign(r, payload)); return res({ data: hit, error: null }); }
        return res({ data: one ? hit[0] ?? null : hit, error: null });
      },
    };
    return q;
  }
  return { t, from };
}

/** A stand-in ZimmerStack API: records every call and answers in the API's { data } envelope. */
function fakeApi(handlers: Record<string, (body: any, url: URL) => unknown>) {
  const calls: { method: string; path: string; body: any; auth: string | null }[] = [];
  const fetch = (async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const path = url.pathname.replace('/api/v1/connect-api/v1', '');
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const auth = new Headers(init?.headers).get('authorization');
    calls.push({ method: init?.method ?? 'GET', path, body, auth });
    const h = handlers[`${init?.method ?? 'GET'} ${path}`];
    if (!h) return new Response(JSON.stringify({ message: 'not in fake', data: { code: 'NOT_FOUND' } }), { status: 404 });
    return new Response(JSON.stringify({ data: h(body, url) }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fetch, calls };
}

const accepted = (cells: number) => ({ batchId: 'b1', resource: 'availability', requestedCells: cells, acceptedCells: cells, noopCells: 0, rejected: [], pushedBy: 'ari-projector', poll: '/batches/b1' });
const hostelRow = (over: Row = {}) => ({ id: HOSTEL_ID, name: 'XTSY Travellers Hostel', enabled: true, zs_property_id: 501, zs_mode: 'test', zs_live: true, event_place: 0, last_event_at: null, ...over });
const fullMap = () => channelProperty(HOSTEL_ID).roomTypes.map((r, i) => ({ property_id: HOSTEL_ID, room_type_id: r.ref, zs_mode: 'test', zs_room_type_id: 100 + i, zs_rate_plan_id: 900 + i }));

describe('what each property sells on ZimmerStack', () => {
  it('sends the hostel’s seven room types by XTSY id, beds as rooms, prices as exact rupee strings', () => {
    const hostel = channelProperty(HOSTEL_ID);
    expect(hostel.roomTypes).toHaveLength(7);
    expect(hostel.roomTypes.find((r) => r.ref === 'bed-in-6-bed-mixed-dormitory')).toMatchObject({ roomCount: 18, adults: 1, rate: '500.00', planRef: 'bed-in-6-bed-mixed-dormitory--room-only' });
    expect(hostel.roomTypes.find((r) => r.ref === 'experience-by-xtsy')).toMatchObject({ roomCount: 1, adults: 2, rate: '4999.00' });
    expect(channelProperty(CAMP_ID).roomTypes).toEqual([expect.objectContaining({ ref: 'shnonpedeng-tent', roomCount: 10, rate: '1400.00' })]);
    expect(paiseToRupeeString(12345)).toBe('123.45');
  });
});

describe('only what changed is sent', () => {
  it('folds equal consecutive nights into one range and skips nights already sent', () => {
    const cells = [
      { roomTypeId: 'a', night: '2026-12-01', available: 3 }, { roomTypeId: 'a', night: '2026-12-02', available: 3 },
      { roomTypeId: 'a', night: '2026-12-03', available: 1 }, { roomTypeId: 'a', night: '2026-12-05', available: 1 },
    ];
    expect(toRanges(cells)).toEqual([
      { roomTypeRef: 'a', dateFrom: '2026-12-01', dateTo: '2026-12-02', available: 3 },
      { roomTypeRef: 'a', dateFrom: '2026-12-03', dateTo: '2026-12-03', available: 1 },
      { roomTypeRef: 'a', dateFrom: '2026-12-05', dateTo: '2026-12-05', available: 1 },
    ]);
    expect(changedCounts(cells, new Map([['a|2026-12-01', 3], ['a|2026-12-03', 2]]))).toHaveLength(3);
  });
  it('finds the nights an edit of the sheet changed, including nights added or removed', () => {
    expect(changedSheetNights({ a: { '2026-12-01': 2, '2026-12-02': 2 } }, { a: { '2026-12-01': 1, '2026-12-02': 2, '2026-12-03': 4 } }))
      .toEqual([{ roomTypeId: 'a', night: '2026-12-01' }, { roomTypeId: 'a', night: '2026-12-03' }]);
  });
});

describe('OTA bookings hold their rooms on /book', () => {
  const booking = { status: 'CONFIRMED' as const, check_in: '2026-12-01', check_out: '2026-12-03', rooms: [{ roomTypeId: 'r', units: 2 }], sheet_at_arrival: { r: { '2026-12-01': 5, '2026-12-02': 5 } }, received_at: '2026-11-26T05:00:00Z' };
  it('until the owner edits that night in the sheet, or the booking is cancelled', () => {
    expect(otaHolds([booking], { r: { '2026-12-01': 5, '2026-12-02': 3 } }, '2026-11-26')).toEqual([
      { unit: 'r', start: '2026-12-01', end: '2026-12-01', state: 'blocked', units: 2, at: booking.received_at },
    ]);
    expect(otaHolds([{ ...booking, status: 'CANCELLED' }], {}, '2026-11-26')).toEqual([]);
    expect(otaHolds([booking], {}, '2026-12-02')).toHaveLength(1); // past nights are left out
  });
});

describe('ZimmerStack connection', () => {
  it('needs a well-formed key; the key never appears in what the console gets back', async () => {
    expect(keyMode(undefined)).toBeNull();
    expect(keyMode('zsk_test_short')).toBeNull();
    expect(keyMode(SANDBOX)).toBe('test');
    const db = fakeDb({ be_channel_properties: [hostelRow({ enabled: false })] });
    const r = await pushCounts({ db, env: { ZIMMERSTACK_CONNECT_KEY: SANDBOX }, now: NOW }, HOSTEL_ID, [{ roomTypeId: 'experience-by-xtsy', night: '2026-12-01' }], 'sheet');
    expect(r).toEqual({ sent: 0, skipped: 'XTSY Travellers Hostel is switched off for the channel manager.' });
    expect(JSON.stringify(r)).not.toContain(SANDBOX);
  });

  it('sends only changed nights, as ranges, with the key only in the Authorization header; a repeat sends nothing', async () => {
    const api = fakeApi({ 'PUT /availability': (b) => accepted(b.updates.length) });
    const db = fakeDb({ be_channel_properties: [hostelRow()] });
    const d = { db, env: { ZIMMERSTACK_CONNECT_KEY: SANDBOX }, now: NOW, fetch: api.fetch };
    const nights = ['2026-12-01', '2026-12-02', '2026-12-03'].map((night) => ({ roomTypeId: 'experience-by-xtsy', night }));
    const first = await pushCounts(d, HOSTEL_ID, nights, 'sheet');
    expect(first.sent).toBe(3);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]).toMatchObject({ method: 'PUT', path: '/availability', body: { updates: [{ roomTypeRef: 'experience-by-xtsy', dateFrom: '2026-12-01', dateTo: '2026-12-03', available: 1 }] } });
    expect(api.calls[0].auth).toBe(`Bearer ${SANDBOX}`);
    expect(JSON.stringify(api.calls[0].body)).not.toContain(SANDBOX);
    expect(db.t.be_channel_sent_counts).toHaveLength(3);
    expect((await pushCounts(d, HOSTEL_ID, nights, 'sheet')).sent).toBe(0);
    expect(api.calls).toHaveLength(1);
  });

  it('adds a hotel only when its switch is on, and links its room types', async () => {
    const roomTypes = channelProperty(HOSTEL_ID).roomTypes.map((r, i) => ({ id: 100 + i, ref: r.ref, name: r.name, maxAdults: r.adults, maxChildren: 0, roomKind: 'room', sync: 'IN_SYNC' }));
    const api = fakeApi({
      'POST /properties': () => ({ id: 777, name: 'XTSY Travellers Hostel', timezone: 'Asia/Kolkata', currency: 'INR', channelManager: true, sandbox: true, billing: { state: 'NOT_BILLED', reason: null, message: 'Sandbox: not billed.' }, replay: false }),
      'GET /catalog': () => ({ currency: 'INR', roomTypes, ratePlans: roomTypes.map((r, i) => ({ id: 900 + i, ref: null, roomTypeId: r.id, name: 'Room only', mealPlan: 'EP', occupancy: null, currency: 'INR', refundable: false, sync: 'IN_SYNC' })) }),
    });
    const owner = { name: 'XTSY Ventures Private Limited', email: 'admin@xtsy.one', phone: '+91 88373 17070' };
    const off = fakeDb({ be_channel_properties: [hostelRow({ enabled: false, zs_property_id: null, zs_mode: null })] });
    await expect(addHotel({ db: off, env: { ZIMMERSTACK_CONNECT_KEY: SANDBOX }, now: NOW, fetch: api.fetch }, HOSTEL_ID, owner)).rejects.toThrow(/Switch this property on/);
    expect(api.calls).toHaveLength(0);
    const db = fakeDb({ be_channel_properties: [hostelRow({ zs_property_id: null, zs_mode: null })] });
    const r = await addHotel({ db, env: { ZIMMERSTACK_CONNECT_KEY: SANDBOX }, now: NOW, fetch: api.fetch }, HOSTEL_ID, owner);
    expect(r).toMatchObject({ ok: true, zsPropertyId: 777, mapped: 7, missingPlans: [] });
    const created = api.calls[0].body;
    expect(created).toMatchObject({ name: 'XTSY Travellers Hostel', currency: 'INR', timezone: 'Asia/Kolkata', address: { country: 'IN', city: 'Shillong' } });
    expect(created.roomTypes).toHaveLength(7);
    expect(db.t.be_channel_properties[0]).toMatchObject({ zs_property_id: 777, zs_mode: 'test', zs_live: true });
    expect(await hostelChannelStatus({ db, env: { ZIMMERSTACK_CONNECT_KEY: SANDBOX }, now: NOW })).toEqual({ connected: true, unmapped: [] });
  });

  it('sends a website booking with ZimmerStack’s room ids and exact rupee amounts', async () => {
    const api = fakeApi({ 'POST /bookings': (b) => ({ bookingId: 1, reference: 'SB-1', externalReference: b.externalReference }) });
    const db = fakeDb({ be_channel_properties: [hostelRow()], be_channel_room_map: fullMap() });
    const d = { db, env: { ZIMMERSTACK_CONNECT_KEY: SANDBOX }, now: NOW, fetch: api.fetch };
    const ch = zimmerstackChannel(d, await hostelChannelStatus(d));
    const r = await ch.pushReservation({
      reference: 'XTSY-ABC234', status: 'confirmed', checkIn: '2026-12-10', checkOut: '2026-12-12',
      rooms: [{ roomTypeId: 'bed-in-6-bed-mixed-dormitory', units: 2, guests: 2, nightlyRates: [50000, 50000] }],
      guestName: 'Asha Verma', guestPhone: '+919876543210', total: 210000, paid: 52500,
    });
    expect(r).toEqual({ acknowledged: true, channelId: 'SB-1' });
    expect(api.calls[0].body).toMatchObject({
      externalReference: 'XTSY-ABC234', currency: 'INR', nightlyRateIncludesTaxes: false,
      rooms: [{ roomTypeId: 102, ratePlanId: 902, adults: 1, nightlyRate: '500.00' }, { roomTypeId: 102, ratePlanId: 902, adults: 1, nightlyRate: '500.00' }],
      payment: { amount: '525.00', method: 'ONLINE' },
    });
  });
});

describe('ZimmerStack webhook', () => {
  const secretBytes = new Uint8Array(32).fill(7);
  const signingSecret = `whsec_${Buffer.from(secretBytes).toString('base64')}`;
  async function sign(body: string, id = 'evt_1', ts = Math.floor(Date.now() / 1000)) {
    const key = await webcrypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = Buffer.from(await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`))).toString('base64');
    return { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${sig}`, 'content-type': 'application/json' };
  }
  const otaEvent = (sequence: number) => ({
    id: `evt_${sequence}`, type: 'channel.booking.created', apiVersion: '1', occurredAt: '2026-11-26T05:59:00Z', mode: 'test', sequence,
    property: { id: 501, name: 'XTSY Travellers Hostel', currency: 'INR', timezone: 'Asia/Kolkata' }, changes: null, previous: null,
    data: { booking: {
      id: 4001, reference: 'ZS-4001', version: 1, status: 'CONFIRMED', stayStatus: 'UPCOMING',
      channel: { otaName: 'Booking.com', otaReservationCode: 'BDC-1', source: 'ota', sourceGroup: 'ota' },
      stay: { checkIn: '2026-12-05', checkOut: '2026-12-07', nights: 2, dayUse: false },
      guest: { fullName: 'Ravi K', firstName: 'Ravi', lastName: 'K', phone: '+919800000000', email: null, country: 'IN', language: 'en' },
      guestNotes: null, occupancy: { adults: 2, children: 0 },
      rooms: [{ roomTypeId: 102, roomTypeName: 'Bed', status: 'UPCOMING' }, { roomTypeId: 102, roomTypeName: 'Bed', status: 'UPCOMING' }],
      amounts: { currency: 'INR', total: 2000, paid: 0, balanceDue: 2000, paymentCollect: 'property' }, finance: null, cancellation: null,
      createdAt: '2026-11-26T05:59:00Z', updatedAt: '2026-11-26T05:59:00Z',
    } },
  });

  it('refuses unsigned or forged deliveries before touching anything', async () => {
    const db = fakeDb({ be_channel_properties: [hostelRow()] });
    const env = { ZIMMERSTACK_CONNECT_KEY: SANDBOX, ZIMMERSTACK_WEBHOOK_SECRET: signingSecret };
    const body = JSON.stringify(otaEvent(1));
    const forged = await handleZimmerstackWebhook(new Request('https://xtsy.one/api/public/hooks/zimmerstack', { method: 'POST', body, headers: { ...(await sign(body)), 'webhook-signature': 'v1,AAAA' } }), { db, env, now: NOW });
    expect(forged.status).toBe(400);
    const unsigned = await handleZimmerstackWebhook(new Request('https://xtsy.one/x', { method: 'POST', body }), { db, env, now: NOW });
    expect(unsigned.status).toBe(400);
    expect(await handleZimmerstackWebhook(new Request('https://xtsy.one/x', { method: 'POST', body }), { db, env: {}, now: NOW })).toMatchObject({ status: 503 });
    expect(db.t.be_ota_bookings).toHaveLength(0);
  });

  it('a verified delivery reads the event log from the saved place; repeats change nothing', async () => {
    const events = [otaEvent(1)];
    const api = fakeApi({ 'GET /events': (_b, url) => ({ items: events.filter((e) => e.sequence > Number(url.searchParams.get('after') ?? 0)), more: false, nextAfter: events.length, earliestSequence: 1, retentionDays: 90 }) });
    const db = fakeDb({
      be_channel_properties: [hostelRow()], be_channel_room_map: fullMap(),
      be_sheet_availability: [{ version: 1, room_type_id: 'bed-in-6-bed-mixed-dormitory', night: '2026-12-05', free: 9 }],
    });
    const env = { ZIMMERSTACK_CONNECT_KEY: SANDBOX, ZIMMERSTACK_WEBHOOK_SECRET: signingSecret };
    const body = JSON.stringify(otaEvent(1));
    const res = await handleZimmerstackWebhook(new Request('https://xtsy.one/api/public/hooks/zimmerstack', { method: 'POST', body, headers: await sign(body) }), { db, env, now: NOW, fetch: api.fetch });
    expect(res.status).toBe(200);
    expect(db.t.be_ota_bookings).toHaveLength(1);
    expect(db.t.be_ota_bookings[0]).toMatchObject({
      zs_booking_id: 4001, property_id: HOSTEL_ID, status: 'CONFIRMED', ota_name: 'Booking.com', guest_phone: '+919800000000',
      rooms: [{ roomTypeId: 'bed-in-6-bed-mixed-dormitory', units: 2 }], sheet_at_arrival: { 'bed-in-6-bed-mixed-dormitory': { '2026-12-05': 9 } },
    });
    expect(db.t.be_channel_properties[0].event_place).toBe(1);
    // The same delivery again, or a scheduled catch-up: the log is read from place 1, nothing new.
    await catchUp({ db, env, now: NOW, fetch: api.fetch }, HOSTEL_ID);
    expect(db.t.be_ota_bookings).toHaveLength(1);
  });
});
