import { describe, expect, it } from 'vitest';
import { FAILS_PER_BOOKING_HOUR, manageLookup, payBalance, phoneMatches, requestDateChange } from '@/booking/manageBooking.server';
import { nearestOpenStays, suggestionRange } from '@/booking/nearestDates';
import { isRepeatOf, otaHolds, sameOtaStay, type OtaBookingRow } from '@/booking/channel/zimmerstackPlan';
import { settleLink } from '@/booking/publicEngine.core';
import type { PaymentGateway } from '@/booking/payments/gateway';

type Row = Record<string, any>;
/** Just enough of the Supabase client for these flows. */
function fakeDb(seed: Record<string, Row[]>) {
  const t: Record<string, Row[]> = { be_guest_lookups: [], be_payments: [], be_change_requests: [], be_audit_log: [], ...seed };
  let seq = 0;
  const from = (table: string) => {
    const f: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'insert' | 'update' = 'select'; let payload: any; let one = false; let head = false; let lim = Infinity; let desc = false;
    const q: any = {
      select: (_c?: string, o?: { head?: boolean }) => { head = !!o?.head; return q; },
      eq: (c: string, v: any) => (f.push((r) => r[c] === v), q),
      neq: (c: string, v: any) => (f.push((r) => r[c] !== v), q),
      gte: (c: string, v: any) => (f.push((r) => String(r[c]) >= String(v)), q),
      order: (_c: string, o?: { ascending?: boolean }) => ((desc = o?.ascending === false), q),
      limit: (n: number) => ((lim = n), q),
      maybeSingle: () => ((one = true), q),
      insert: (p: any) => ((op = 'insert'), (payload = p), q),
      update: (p: any) => ((op = 'update'), (payload = p), q),
      then: (res: (v: any) => void) => {
        const rows = (t[table] ??= []);
        if (op === 'insert') {
          if (table === 'be_change_requests' && rows.some((r) => r.booking_id === payload.booking_id && r.status === 'pending')) return res({ data: null, error: { code: '23505' } });
          rows.push({ id: `id${++seq}`, created_at: new Date(Date.UTC(2026, 10, 27, 10, 0, seq)).toISOString(), status: table === 'be_change_requests' ? 'pending' : undefined, ...payload });
          return res({ data: null, error: null });
        }
        let hit = rows.filter((r) => f.every((x) => x(r)));
        if (op === 'update') { hit.forEach((r) => Object.assign(r, payload)); return res({ data: hit, error: null }); }
        if (desc) hit = [...hit].reverse();
        hit = hit.slice(0, lim);
        if (head) return res({ count: hit.length, error: null });
        return res({ data: one ? hit[0] ?? null : hit, error: null });
      },
    };
    return q;
  };
  return { t, from };
}

const NOW = new Date('2026-11-27T10:00:00Z');
const booking = (over: Row = {}) => ({
  id: 'b1', reference: 'XTSY-7KQ2MA', status: 'confirmed', check_in: '2027-01-10', check_out: '2027-01-12', guest_name: 'Priyanka Sharma', guest_phone: '+91 98765 43210',
  total_paise: 200000, advance_paise: 50000, balance_paise: 150000, date_changes_used: 0,
  be_booking_lines: [{ room_type_id: 'bed-in-6-bed-mixed-dormitory', units: 2, guests: 2 }], ...over,
});
function gateway(): PaymentGateway & { links: any[]; linkState: string } {
  const g: any = {
    id: 'zoho', links: [], linkState: 'active',
    createCheckout: async () => ({ sessionId: 's', redirectUrl: 'u' }),
    createPaymentLink: async (req: any) => { g.links.push(req); return { linkId: `L${g.links.length}`, url: `https://pay.example/L${g.links.length}` }; },
    getPaymentLink: async () => ({ status: g.linkState, paymentIds: g.linkState === 'paid' ? ['P1'] : [] }),
    getSession: async () => ({ status: 'pending', paymentIds: [], amount: 0 }),
    verifyWebhook: async () => null, verifyReturn: async () => false,
  };
  return g;
}
const deps = (db: any, gw: any = gateway()) => ({ db, env: {}, now: NOW, gateway: gw });
const paidAdvance = { id: 'p0', booking_id: 'b1', kind: 'advance', status: 'succeeded', amount_paise: 50000, created_at: '2026-11-20T00:00:00Z' };

describe('Manage my booking', () => {
  it('the phone number matches whatever its format', () => {
    expect(phoneMatches('+91 98765 43210', '09876543210')).toBe(true);
    expect(phoneMatches('9876543210', '+91-98765-43210')).toBe(true);
    expect(phoneMatches('9876543210', '9876543211')).toBe(false);
    expect(phoneMatches('12345', '12345')).toBe(false);
  });

  it('shows nothing without the right phone, says the same either way, and locks after repeated tries', async () => {
    const db = fakeDb({ be_bookings: [booking()], be_payments: [paidAdvance] });
    await expect(manageLookup(deps(db), 'XTSY-7KQ2MA', '9999999999', '1.1.1.1')).rejects.toThrow(/couldn’t find a booking with that reference and phone/);
    await expect(manageLookup(deps(db), 'XTSY-NOPE12', '9876543210', '1.1.1.1')).rejects.toThrow(/couldn’t find a booking with that reference and phone/);
    for (let i = 1; i < FAILS_PER_BOOKING_HOUR; i++) await manageLookup(deps(db), 'XTSY-7KQ2MA', '9999999999', `2.2.2.${i}`).catch(() => null);
    await expect(manageLookup(deps(db), 'XTSY-7KQ2MA', '9876543210', '3.3.3.3')).rejects.toThrow(/Too many tries/);
    expect(db.t.be_guest_lookups.every((r) => !('phone' in r))).toBe(true); // the phone number is never stored
  });

  it('with reference + phone: what is paid, what is due, and the date change window', async () => {
    const db = fakeDb({ be_bookings: [booking()], be_payments: [paidAdvance] });
    const b = await manageLookup(deps(db), 'xtsy-7kq2ma', '98765 43210');
    expect(b).toMatchObject({ reference: 'XTSY-7KQ2MA', status: 'confirmed', firstName: 'Priyanka', paid: 50000, due: 150000, canPay: true });
    expect(b.dateChange).toEqual({ allowed: true, lastDate: '2026-12-27' });
  });

  it('pays the balance through one payment link, reused if pressed twice, and records it once paid', async () => {
    const db = fakeDb({ be_bookings: [booking()], be_payments: [paidAdvance] });
    const gw = gateway();
    const first = await payBalance(deps(db, gw), 'XTSY-7KQ2MA', '9876543210');
    const again = await payBalance(deps(db, gw), 'XTSY-7KQ2MA', '9876543210');
    expect(first).toEqual({ url: 'https://pay.example/L1', amount: 150000 });
    expect(again.url).toBe(first.url);
    expect(gw.links).toHaveLength(1);
    gw.linkState = 'paid';
    expect(await settleLink(deps(db, gw) as any, 'L1')).toBe('paid');
    const b = await manageLookup(deps(db, gw), 'XTSY-7KQ2MA', '9876543210');
    expect(b).toMatchObject({ paid: 200000, due: 0, canPay: false });
  });

  it('no online payment without the gateway keys', async () => {
    const db = fakeDb({ be_bookings: [booking()], be_payments: [paidAdvance] });
    expect((await manageLookup(deps(db, null), 'XTSY-7KQ2MA', '9876543210')).canPay).toBe(false);
  });

  it('a date change is a request for the desk, one at a time, never within 14 days', async () => {
    const db = fakeDb({ be_bookings: [booking()], be_payments: [paidAdvance] });
    await expect(requestDateChange(deps(db), 'XTSY-7KQ2MA', '9876543210', undefined, '2026-12-01', '2026-12-03')).rejects.toThrow(/at least 14 days from today/);
    const b = await requestDateChange(deps(db), 'XTSY-7KQ2MA', '9876543210', undefined, '2027-01-11', '2027-01-13', 'Flight moved');
    expect(b.request).toMatchObject({ checkIn: '2027-01-11', checkOut: '2027-01-13', status: 'pending' });
    expect(b.dateChange.allowed).toBe(false);
    await expect(requestDateChange(deps(db), 'XTSY-7KQ2MA', '9876543210', undefined, '2027-01-12', '2027-01-14')).rejects.toThrow(/request is (already )?with the desk/);
  });

  it('a booking inside 14 days, or one that used its change, cannot ask', async () => {
    const db = fakeDb({ be_bookings: [booking({ check_in: '2026-12-05', check_out: '2026-12-07' }), booking({ id: 'b2', reference: 'XTSY-USED01', date_changes_used: 1 })], be_payments: [paidAdvance] });
    expect((await manageLookup(deps(db), 'XTSY-7KQ2MA', '9876543210')).dateChange).toMatchObject({ allowed: false, reason: expect.stringMatching(/14 days/) });
    expect((await manageLookup(deps(db), 'XTSY-USED01', '9876543210')).dateChange).toMatchObject({ allowed: false, reason: expect.stringMatching(/already used/) });
  });
});

describe('Nearest dates with space', () => {
  const full = new Set(['2026-12-10', '2026-12-11', '2026-12-12']); // nights with nothing free
  const openFrom = (ci: string, co: string) => {
    for (let d = new Date(`${ci}T00:00:00Z`); d < new Date(`${co}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) if (full.has(d.toISOString().slice(0, 10))) return null;
    return 40000;
  };
  it('closest first, same number of nights', () => {
    expect(nearestOpenStays('2026-12-11', 1, '2026-11-27', 365, openFrom)[0]).toEqual({ checkIn: '2026-12-13', checkOut: '2026-12-14', fromRate: 40000 }); // 2 later beats 2 earlier
    expect(nearestOpenStays('2026-12-10', 2, '2026-11-27', 365, openFrom)).toEqual([
      { checkIn: '2026-12-08', checkOut: '2026-12-10', fromRate: 40000 }, // 2 days earlier
      { checkIn: '2026-12-13', checkOut: '2026-12-15', fromRate: 40000 }, // 3 days later
      { checkIn: '2026-12-07', checkOut: '2026-12-09', fromRate: 40000 }, // 3 days earlier
    ]);
  });
  it('never suggests the past', () => {
    expect(nearestOpenStays('2026-11-28', 1, '2026-11-27', 365, () => 1).map((s) => s.checkIn)).not.toContain('2026-11-26');
    expect(suggestionRange('2026-11-28', 2, '2026-11-27')).toEqual({ from: '2026-11-27', to: '2026-12-14' });
  });
});

describe('OTA reservation sent twice', () => {
  const row = (over: Partial<OtaBookingRow>): OtaBookingRow => ({ status: 'CONFIRMED', check_in: '2026-12-05', check_out: '2026-12-07', rooms: [{ roomTypeId: 'r', units: 2 }], sheet_at_arrival: {}, received_at: 'a', ...over });
  it('the same stay holds its rooms once', () => {
    const first = row({ zs_booking_id: 1 });
    const again = row({ zs_booking_id: 2, duplicate_of: 1 });
    expect(isRepeatOf(again, new Map([[1, first], [2, again]]))).toBe(true);
    expect(otaHolds([first, again], {}, '2026-11-27')).toHaveLength(2); // 2 nights, held once
  });
  it('a different stay under the same code holds too (safe), and is flagged in the console', () => {
    const first = row({ zs_booking_id: 1 });
    const other = row({ zs_booking_id: 2, duplicate_of: 1, check_out: '2026-12-08' });
    expect(sameOtaStay(first, other)).toBe(false);
    expect(otaHolds([first, other], {}, '2026-11-27')).toHaveLength(5);
  });
  it('if the first was cancelled, the repeat holds', () => {
    const first = row({ zs_booking_id: 1, status: 'CANCELLED' });
    const again = row({ zs_booking_id: 2, duplicate_of: 1 });
    expect(otaHolds([first, again], {}, '2026-11-27')).toHaveLength(2);
  });
});
