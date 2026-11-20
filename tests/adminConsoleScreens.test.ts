/**
 * Renders the booking-engine console screens with mocked server functions: once before the
 * database exists, once with data. Signing in needs the live backend, so it is not covered here.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { settingsFromRow } from '@/booking/consoleSettings';

vi.mock('@tanstack/react-start', async (orig) => ({ ...(await orig<object>()), useServerFn: (fn: unknown) => fn }));
vi.mock('@/admin/bookingConsole.functions', () => {
  const stub = Object.assign(async () => ({}), {});
  return {
    getBookingEngineStatus: stub, saveBookingSettings: stub, setBookingLaunchSwitch: stub, saveStaahMapping: stub,
    listEngineBookings: stub, getEngineBooking: stub, changeEngineBookingDates: stub, cancelEngineBooking: stub,
    createEngineBalanceLink: stub, runStaahTest: stub, getStaahLog: stub, runEngineNightAudit: stub, getEngineAuditLog: stub,
  };
});

const notReady = { dbReady: false, blockers: ['Booking database is not set up yet.'] };
const ready = {
  dbReady: true,
  settings: { ...settingsFromRow(null) },
  mapping: [{ roomTypeId: 'experience-by-xtsy', roomCode: 'R7', rateCode: 'RO' }],
  state: { switchedOn: false, gatewayConfigured: false, botProtection: false, channelConnected: false, unmappedRoomTypes: BOOKING_ROOM_TYPES.slice(0, 6).map((r) => r.id), feeTableProblems: [], databaseReady: true },
  blockers: ['STAAH is not connected.', 'Payment gateway keys are not saved.', 'Live booking is switched off in the admin console.'],
};

async function render(page: string, data: Record<string, unknown>) {
  const mod = await import(`../src/routes/(admin)/admin/${page}.tsx`);
  const Component = mod.Route.options.component as ComponentType;
  const qc = new QueryClient();
  for (const [key, value] of Object.entries(data)) qc.setQueryData(JSON.parse(key), value);
  return renderToString(createElement(QueryClientProvider, { client: qc }, createElement(Component))).replace(/<!-- -->/g, '');
}

describe('console screens before the database exists', () => {
  it.each([
    ['booking-engine', { '["engine","status"]': notReady }],
    ['staah', { '["engine","status"]': notReady }],
    ['bookings', { '["engine","bookings",{}]': { dbReady: false, rows: [] } }],
    ['night-audit', { '["engine","audit-log"]': { dbReady: false, rows: [] } }],
  ])('%s explains that the database is not set up', async (page, data) => {
    expect(await render(page, data)).toContain('The booking database is not set up yet.');
  });
});

describe('Booking engine page', () => {
  it('shows the locked launch switch with every blocker', async () => {
    const html = await render('booking-engine', { '["engine","status"]': ready });
    expect(html).toContain('WhatsApp enquiries on /book');
    expect(html).toContain('Switch live booking on');
    for (const b of ready.blockers) expect(html).toContain(b);
  });
  it('lists a GST slab picker for all seven rooms and breakfast', async () => {
    const html = await render('booking-engine', { '["engine","status"]': ready });
    for (const r of BOOKING_ROOM_TYPES) expect(html).toContain(r.name);
    expect(html).toContain('Breakfast (TAB Bistro)');
    expect(html.match(/5% — tariff up to ₹7,500/g)?.length).toBe(8);
  });
  it('shows each payment method with Zoho\'s fee and a worked example', async () => {
    const html = await render('booking-engine', { '["engine","status"]': ready });
    expect(html).toContain('Credit card');
    expect(html).toContain('₹19.90 + ₹3.58 GST'); // 1.99% of ₹1,000, plus 18% GST
    expect(html).toContain('₹5 + ₹0.90 GST'); // UPI 0.5%
  });
});

describe('STAAH page', () => {
  it('shows the three tests and a code row per room, marking which are mapped', async () => {
    const html = await render('staah', { '["engine","status"]': ready, '["engine","staah-log"]': { dbReady: true, rows: [] } });
    for (const label of ['Check connection', 'Pull rates and availability (14 days)', 'Send a test booking']) expect(html).toContain(label);
    for (const r of BOOKING_ROOM_TYPES) expect(html).toContain(r.id);
    expect(html.match(/not mapped/g)?.length).toBe(6);
    expect(html).toContain('No STAAH messages yet.');
  });
});

describe('Bookings page', () => {
  it('says there are no bookings until live booking starts', async () => {
    expect(await render('bookings', { '["engine","bookings",{}]': { dbReady: true, rows: [] } })).toContain('No bookings yet');
  });
  it('lists bookings with money in rupees', async () => {
    const row = { id: '6f1c5a8e-0000-4000-8000-000000000001', reference: 'XTSY-7KQ2M', status: 'confirmed', check_in: '2026-12-10', check_out: '2026-12-12', guest_name: 'Asha', total_paise: 210000, balance_paise: 157500, channel_status: 'synced' };
    const html = await render('bookings', { '["engine","bookings",{}]': { dbReady: true, rows: [row] } });
    for (const s of ['XTSY-7KQ2M', 'Asha', '2026-12-10 → 2026-12-12', 'Confirmed', '₹2,100', '₹1,575', 'synced']) expect(html).toContain(s);
  });
});

describe('Night audit page', () => {
  it('shows the run button and the console activity', async () => {
    const html = await render('night-audit', { '["engine","audit-log"]': { dbReady: true, rows: [{ id: 'a1', action: 'settings.save', details: {}, actor_email: 'admin@xtsy.one', created_at: '2026-11-19T10:00:00Z' }] } });
    expect(html).toContain('Run night audit');
    expect(html).toContain('settings.save');
    expect(html).toContain('admin@xtsy.one');
  });
});
