import { describe, expect, it } from 'vitest';
import * as core from '@/admin/bookingConsole.core';
import type { ChannelManager } from '@/booking/channel/channelManager';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { reviewSettings, settingsFromRow } from '@/booking/consoleSettings';
import { financialYear, invoiceNumber } from '@/booking/invoiceNumber';
import { nightAudit } from '@/booking/reconcile';
import { DEFAULT_FEE_TABLE } from '@/booking/payments/fees';
import type { PaymentGateway } from '@/booking/payments/gateway';

/** A small stand-in for the Supabase query builder over in-memory tables. */
function fakeDb(tables: Record<string, any[]>, missing: string[] = []) {
  const from = (name: string) => {
    let rows = () => tables[name] ?? [];
    const filters: ((r: any) => boolean)[] = [];
    let mode: 'select' | 'insert' | 'update' | 'upsert' = 'select', payload: any, single = false, maybe = false;
    const q: any = {
      select: () => q, order: () => q, limit: () => q, or: () => q,
      eq: (c: string, v: any) => (filters.push((r) => r[c] === v), q),
      neq: (c: string, v: any) => (filters.push((r) => r[c] !== v), q),
      gte: (c: string, v: any) => (filters.push((r) => r[c] >= v), q),
      lte: (c: string, v: any) => (filters.push((r) => r[c] <= v), q),
      insert: (p: any) => ((mode = 'insert'), (payload = p), q),
      update: (p: any) => ((mode = 'update'), (payload = p), q),
      upsert: (p: any) => ((mode = 'upsert'), (payload = p), q),
      maybeSingle: () => ((maybe = true), q),
      single: () => ((single = true), q),
      then: (resolve: (v: any) => void) => {
        if (missing.includes(name)) return resolve({ data: null, error: { code: '42P01', message: `relation "${name}" does not exist` } });
        tables[name] ??= [];
        if (mode === 'insert') { for (const r of [payload].flat()) tables[name].push({ id: `id-${tables[name].length}`, created_at: '2026-11-19T00:00:00Z', ...r }); return resolve({ data: null, error: null }); }
        if (mode === 'upsert') { for (const r of [payload].flat()) { const i = tables[name].findIndex((x) => x.room_type_id === r.room_type_id); i >= 0 ? (tables[name][i] = r) : tables[name].push(r); } return resolve({ data: null, error: null }); }
        const hit = rows().filter((r) => filters.every((f) => f(r)));
        if (mode === 'update') { hit.forEach((r) => Object.assign(r, payload)); return resolve({ data: null, error: null }); }
        resolve({ data: maybe || single ? hit[0] ?? null : hit, error: null });
      },
    };
    return q;
  };
  return { from };
}

const NOW = new Date('2026-11-19T06:00:00Z');
const connected: ChannelManager = { id: 'staah', connected: true, getAri: async () => [], pushReservation: async () => ({ acknowledged: true, channelId: 'S-1' }) };
const fakeGateway = { id: 'zoho', createPaymentLink: async () => ({ linkId: 'pl_1', url: 'https://pay/pl_1' }) } as unknown as PaymentGateway;
const mappedAll = BOOKING_ROOM_TYPES.map((r) => ({ room_type_id: r.id, staah_room_code: `R-${r.id}`, staah_rate_code: 'RO' }));
const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b1', reference: 'XTSY-AAAA1', status: 'confirmed', check_in: '2026-12-10', check_out: '2026-12-12', date_changes_used: 0,
  total_paise: 210000, advance_paise: 52500, balance_paise: 157500, channel_status: 'synced', ...over,
});
const deps = (tables: Record<string, any[]>, extra: Partial<core.ConsoleDeps> = {}, missing: string[] = []): core.ConsoleDeps =>
  ({ db: fakeDb(tables, missing), env: {}, now: NOW, gateway: null, ...extra });

describe('console before the database exists', () => {
  it('reports "not set up" instead of failing', async () => {
    const all = ['be_settings', 'be_bookings', 'be_channel_log', 'be_audit_log'];
    expect(await core.loadStatus(deps({}, {}, all))).toEqual({ dbReady: false, blockers: ['Booking database is not set up yet.'] });
    expect((await core.listBookings(deps({}, {}, all), {})).dbReady).toBe(false);
    expect((await core.runNightAudit(deps({}, {}, all))).dbReady).toBe(false);
    expect((await core.channelLog(deps({}, {}, all))).dbReady).toBe(false);
  });
});

describe('launch switch', () => {
  it('lists today\'s blockers: STAAH, mapping, gateway keys, bot check and the switch', async () => {
    const s = await core.loadStatus(deps({ be_settings: [{ id: 1 }], be_room_mapping: [] }));
    expect(s.dbReady && s.blockers).toEqual([
      'No channel manager or PMS is connected.',
      `Room types not mapped to the channel manager: ${BOOKING_ROOM_TYPES.map((r) => r.id).join(', ')}.`,
      'Payment gateway keys are not saved.',
      'Bot protection keys (Cloudflare Turnstile) are not saved.',
      'Live booking is switched off in the admin console.',
    ]);
  });
  it('refuses to switch on while STAAH is not connected, and logs nothing', async () => {
    const t = { be_settings: [{ id: 1 }], be_room_mapping: mappedAll, be_audit_log: [] as any[] };
    await expect(core.setLaunchSwitch(deps(t, { gateway: fakeGateway }), true)).rejects.toThrow(/No channel manager or PMS is connected/);
    expect(t.be_settings[0].engine_switched_on).toBeUndefined();
    expect(t.be_audit_log).toHaveLength(0);
  });
  it('switches on when everything is ready, and off at any time', async () => {
    const t = { be_settings: [{ id: 1 }], be_room_mapping: mappedAll, be_audit_log: [] as any[] };
    const d = deps(t, { gateway: fakeGateway, channel: connected, env: { TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'test-value' } });
    await core.setLaunchSwitch(d, true);
    expect(t.be_settings[0].engine_switched_on).toBe(true);
    await core.setLaunchSwitch(deps(t), false);
    expect(t.be_settings[0].engine_switched_on).toBe(false);
    expect(t.be_audit_log.map((a) => a.action)).toEqual(['launch.on', 'launch.off']);
  });
});

describe('settings', () => {
  const base = { activeGateway: 'zoho' as const, holdMinutes: 15, feeTable: DEFAULT_FEE_TABLE, gstSlabs: settingsFromRow(null).gstSlabs, breakfastGst: { kind: '5' as const } };
  it('suggests 5% GST for every room today, all under ₹7,500 a night', () => {
    expect(Object.values(settingsFromRow(null).gstSlabs).every((s) => s.kind === '5')).toBe(true);
  });
  it('saves valid settings and records who changed what', async () => {
    const t = { be_settings: [{ id: 1 }], be_audit_log: [] as any[] };
    expect((await core.saveSettings(deps(t), base)).warnings).toEqual([]);
    expect(t.be_settings[0].hold_minutes).toBe(15);
    expect(t.be_audit_log[0].action).toBe('settings.save');
  });
  it('warns when a room\'s GST slab does not match its rate', () => {
    expect(reviewSettings({ ...base, gstSlabs: { ...base.gstSlabs, 'experience-by-xtsy': { kind: '18' } } }).warnings[0]).toMatch(/Experience by XTSY: .*usually takes 5%/);
  });
  it('refuses a hold longer than Zoho\'s 15-minute checkout, a charge above Zoho\'s fee, and Razorpay before it exists', async () => {
    const t = { be_settings: [{ id: 1 }], be_audit_log: [] as any[] };
    await expect(core.saveSettings(deps(t), { ...base, holdMinutes: 30 })).rejects.toThrow(/holdMinutes/);
    await expect(core.saveSettings(deps(t), { ...base, feeTable: { ...DEFAULT_FEE_TABLE, upi: { bps: 80 } } })).rejects.toThrow(/more than Zoho/);
    await expect(core.saveSettings(deps(t), { ...base, activeGateway: 'razorpay' })).rejects.toThrow(/Razorpay is not connected/);
    expect(t.be_audit_log).toHaveLength(0);
  });
});

describe('booking actions', () => {
  it('records one date change when STAAH is connected, adding any price increase to the balance', async () => {
    const t = { be_bookings: [booking()], be_booking_lines: [{ booking_id: 'b1', room_type_id: 'bed-in-6-bed-mixed-dormitory', units: 2, guests: 2 }], be_audit_log: [] as any[] };
    const r = await core.changeDates(deps(t, { channel: connected }), 'b1', '2026-12-20', '2026-12-23');
    expect(r.extra).toBe(105000); // 3 nights instead of 2: ₹1,000 + 5% GST more
    expect(t.be_bookings[0]).toMatchObject({ check_in: '2026-12-20', date_changes_used: 1, balance_paise: 262500, channel_status: 'pending' });
  });
  it('never lowers the price on a change: no refunds', async () => {
    const t = { be_bookings: [booking()], be_booking_lines: [{ booking_id: 'b1', room_type_id: 'bed-in-6-bed-mixed-dormitory', units: 2, guests: 2 }], be_audit_log: [] as any[] };
    const r = await core.changeDates(deps(t, { channel: connected }), 'b1', '2026-12-20', '2026-12-21');
    expect([r.extra, t.be_bookings[0].total_paise]).toEqual([0, 210000]);
  });
  it('refuses a change within 14 days, a second change, or with STAAH not connected', async () => {
    const lines = [{ booking_id: 'b1', room_type_id: 'bed-in-6-bed-mixed-dormitory', units: 1, guests: 1 }];
    await expect(core.changeDates(deps({ be_bookings: [booking({ check_in: '2026-11-25' })], be_booking_lines: lines }, { channel: connected }), 'b1', '2026-12-20', '2026-12-21')).rejects.toThrow(/14 days/);
    await expect(core.changeDates(deps({ be_bookings: [booking({ date_changes_used: 1 })], be_booking_lines: lines }, { channel: connected }), 'b1', '2026-12-20', '2026-12-21')).rejects.toThrow(/already used/);
    await expect(core.changeDates(deps({ be_bookings: [booking()], be_booking_lines: lines }), 'b1', '2026-12-20', '2026-12-21')).rejects.toThrow(/No channel manager or PMS is connected/);
  });
  it('keeps everything on a guest cancellation and refunds everything when XTSY cancels', async () => {
    const pays = [{ booking_id: 'b1', kind: 'advance', status: 'succeeded', amount_paise: 52500 }];
    const g = await core.cancelBooking(deps({ be_bookings: [booking()], be_payments: pays, be_audit_log: [] }), 'b1', 'guest', 'Guest changed plans');
    const x = await core.cancelBooking(deps({ be_bookings: [booking()], be_payments: pays, be_audit_log: [] }), 'b1', 'xtsy', 'Water tank repair');
    expect([g.refund, x.refund]).toEqual([0, 52500]);
  });
  it('needs a written reason to cancel', async () => {
    await expect(core.cancelBooking(deps({ be_bookings: [booking()] }), 'b1', 'guest', 'no')).rejects.toThrow(/reason/);
  });
  it('creates a balance link for what is still due', async () => {
    const t = { be_bookings: [booking()], be_payments: [] as any[], be_audit_log: [] as any[] };
    const r = await core.createBalanceLink(deps(t, { gateway: fakeGateway }), 'b1', 'upi');
    expect([r.due, r.url]).toEqual([157500, 'https://pay/pl_1']);
    expect(t.be_payments[0]).toMatchObject({ kind: 'balance', amount_paise: 157500, method_declared: 'upi', status: 'created' });
  });
  it('refuses a balance link without gateway keys', async () => {
    await expect(core.createBalanceLink(deps({ be_bookings: [booking()], be_payments: [] }), 'b1')).rejects.toThrow(/keys are not saved/);
  });
});

describe('STAAH test buttons', () => {
  it('logs a failed test while STAAH is not connected', async () => {
    const t = { be_channel_log: [] as any[] };
    expect(await core.staahTest(deps(t), 'pull')).toEqual({ ok: false, detail: expect.stringMatching(/not connected/) });
    expect(t.be_channel_log[0]).toMatchObject({ direction: 'test', message_type: 'pull', status: 'failed' });
  });
  it('reports success once STAAH is connected', async () => {
    const t = { be_channel_log: [] as any[] };
    expect((await core.staahTest(deps(t, { channel: connected }), 'push_test')).detail).toMatch(/acknowledged.*S-1/);
  });
});

describe('night audit', () => {
  const b = (o: Record<string, unknown>) => ({ id: 'b1', reference: 'XTSY-A', status: 'confirmed', check_in: '2026-11-10', check_out: '2026-11-12', advance_paise: 52500, balance_paise: 157500, channel_status: 'synced', ...o });
  const p = (o: Record<string, unknown>) => ({ id: 'p1', booking_id: 'b1', kind: 'advance', status: 'succeeded', amount_paise: 52500, method_declared: 'upi', method_actual: 'upi', settled_paise: 52500, created_at: '2026-11-01T10:00:00Z', ...o });
  const codes = (bs: any[], ps: any[]) => nightAudit(bs, ps, '2026-11-19').map((i) => i.code);

  it('is clean when everything matches', () => {
    expect(codes([b({ check_out: '2026-12-12' })], [p({})])).toEqual([]);
  });
  it('flags money received for a booking that never confirmed', () => {
    expect(codes([b({ status: 'held', check_out: '2026-12-12' })], [p({})])).toEqual(['paid_not_confirmed']);
  });
  it('flags a confirmed booking with no advance', () => {
    expect(codes([b({ check_out: '2026-12-12' })], [])).toEqual(['confirmed_without_advance']);
  });
  it('flags a short advance, a method switch, a missing settlement and an unsynced STAAH booking', () => {
    expect(codes([b({ check_out: '2026-12-12', channel_status: 'failed' })], [p({ amount_paise: 50000, method_actual: 'credit_card', settled_paise: null })]).sort())
      .toEqual(['advance_amount_mismatch', 'channel_not_synced', 'method_mismatch', 'not_settled']);
  });
  it('flags a balance still unpaid after check-out', () => {
    expect(codes([b({})], [p({})])).toEqual(['balance_unpaid_after_checkout']);
  });
});

describe('invoice numbers', () => {
  it('follows India\'s April–March financial year', () => {
    expect([financialYear('2026-03-31'), financialYear('2026-04-01'), financialYear('2027-01-15')]).toEqual(['2025-26', '2026-27', '2026-27']);
  });
  it('formats receipts and tax invoices in separate series', () => {
    expect(invoiceNumber('tax_invoice', '2026-27', 7)).toBe('XTSY/2026-27/TI/0007');
    expect(invoiceNumber('advance_receipt', '2026-27', 12)).toBe('XTSY/2026-27/AR/0012');
  });
});
