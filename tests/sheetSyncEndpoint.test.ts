import { describe, it, expect, vi, beforeEach } from 'vitest';

const upserts: unknown[][] = [];
vi.mock('@/admin/serviceClient.server', () => ({
  getServiceClient: () => ({ from: () => ({ upsert: async (rows: unknown[]) => { upserts.push(rows); return { error: null }; } }) }),
}));

const { handleSheetAvailability } = await import('@/booking/sheetSync.server');
const SIGN = 'test-sheet-sync-value';
const req = (body: unknown, auth = `Bearer ${SIGN}`) => new Request('https://x/api/public/hooks/sheet-availability', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /api/public/hooks/sheet-availability', () => {
  beforeEach(() => { upserts.length = 0; process.env['SHEET_SYNC_SECRET'] = SIGN; });

  it('refuses without the shared secret', async () => {
    expect((await handleSheetAvailability(req({ cells: [] }, 'Bearer nope'))).status).toBe(401);
    delete process.env['SHEET_SYNC_SECRET'];
    expect((await handleSheetAvailability(req({ cells: [] }))).status).toBe(503);
  });

  it('refuses anything but room numbers, dates and counts', async () => {
    expect((await handleSheetAvailability(req({ cells: [{ roomNo: '8', night: '13 Dec', free: 1 }] }))).status).toBe(400);
    expect((await handleSheetAvailability(req({ cells: [{ roomNo: '8', night: '2026-12-13', free: -1 }] }))).status).toBe(400);
  });

  it('adds room numbers up per room type and saves them; reports unknown rooms', async () => {
    const res = await handleSheetAvailability(req({ cells: [
      { roomNo: '2', night: '2027-02-02', free: 7 }, { roomNo: '3', night: '2027-02-02', free: 7 },
      { roomNo: '99', night: '2027-02-02', free: 4 },
    ] }));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.unknownRooms).toEqual(['99']);
    expect(upserts.flat()).toMatchObject([{ room_type_id: 'bed-in-6-bed-standard-dormitory', night: '2027-02-02', free: 14 }]);
  });
});
