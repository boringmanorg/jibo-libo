import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { buildCalendar, calendarRooms, totals } from '@/admin/inventoryCalendar';
import { activitySentence } from '@/admin/activityText';
import { recordEnquiry, ENQUIRIES_PER_HOUR, visitorHash } from '@/booking/enquiryInbox.server';

describe('console inventory calendar', () => {
  const sheet = { 'bed-in-8-bed-mixed-dormitory': { '2026-12-13': 0, '2026-12-14': 8 }, 'experience-by-xtsy': { '2026-12-13': 1 } };
  const rows = buildCalendar('2026-12-13', 2, sheet, [{ unit: '8-bed-mixed-dorm', start: '2026-12-14', end: '2026-12-14', state: 'blocked', units: 3, at: 'a' }]);
  const r = (id: string) => rows.find((x) => x.id === id)!;

  it('shows the sheet count less console blocks, per night', () => {
    expect(r('bed-in-8-bed-mixed-dormitory').cells.map((c) => [c.start, c.closed, c.free])).toEqual([[0, 0, 0], [8, 3, 5]]);
    expect(r('experience-by-xtsy').cells[0].free).toBe(1);
  });
  it('marks hostel nights the sheet has no number for, and keeps the camp on its own 10 tents', () => {
    expect(r('experience-by-xtsy').cells[1]).toMatchObject({ sheetMissing: true, free: 0 });
    expect(r('shnonpedeng-tent').cells.map((c) => c.free)).toEqual([10, 10]);
  });
  it('adds beds, rooms and tents separately', () => {
    expect(totals(rows, 1).beds.free).toBe(5);
    expect(totals(rows, 0).tents).toEqual({ free: 10, total: 10 });
  });
  it('gives every row the id the block form needs', () => {
    expect(calendarRooms().map((x) => x.consoleUnitId)).toContain('8-bed-mixed-dorm');
    expect(calendarRooms().every((x) => x.consoleUnitId && x.propertyId)).toBe(true);
  });
});

describe('console activity in plain words', () => {
  it('turns block records into sentences', () => {
    expect(activitySentence('inventory.blocked', { unitTypeId: '8-bed-mixed-dorm', startDate: '2026-11-21', endDate: '2026-11-22', units: 3, reason: 'Deep clean' }))
      .toBe('Closed 3 of Bed in 8-Bed Mixed Dormitory for 21 Nov – 22 Nov (Deep clean)');
    expect(activitySentence('inventory.blocked', { unitTypeId: '__property__', propertyId: 'XTSY-SHL-HOSTEL', startDate: '2026-11-20', endDate: '2026-11-20' }))
      .toBe('Closed all of XTSY Travellers Hostel for 20 Nov');
    expect(activitySentence('inventory.open', { unitTypeId: 'shnonpedeng-tent', startDate: '2026-12-01', endDate: '2026-12-02' })).toMatch(/^Reopened Riverside tent/);
  });
});

describe('enquiry inbox', () => {
  const input = { reference: 'XTSY-ABCDE', kind: 'stay' as const, name: 'Guest', phone: '9876543210', checkIn: '2026-12-01', checkOut: '2026-12-02', guests: 1, summary: 'x', estimate: 420 };
  const fakeDb = (recent: number, inserted: unknown[]) => ({
    from: () => ({
      select: () => ({ eq: () => ({ gte: async () => ({ count: recent, error: null }) }) }),
      insert: async (row: unknown) => { inserted.push(row); return { error: null }; },
    }),
  });
  it('saves an enquiry with a hashed visitor id, never the raw IP', async () => {
    const rows: any[] = [];
    expect(await recordEnquiry(fakeDb(0, rows), input, '203.0.113.9')).toEqual({ saved: true });
    expect(rows[0]).toMatchObject({ reference: 'XTSY-ABCDE', estimate_rupees: 420 });
    expect(JSON.stringify(rows[0])).not.toContain('203.0.113.9');
    expect(visitorHash('203.0.113.9', '2026-11-21')).toHaveLength(32);
  });
  it('stops a visitor after the hourly limit', async () => {
    const rows: unknown[] = [];
    expect(await recordEnquiry(fakeDb(ENQUIRIES_PER_HOUR, rows), input, '1.2.3.4')).toEqual({ saved: false, reason: 'rate-limited' });
    expect(rows).toHaveLength(0);
  });
});

describe('console screens the owner removed', () => {
  it('night audit, Form C and STAAH pages are gone from the console and its menu', () => {
    for (const page of ['night-audit', 'form-c', 'staah']) expect(existsSync(`src/routes/(admin)/admin/${page}.tsx`)).toBe(false);
    expect(readFileSync('src/routes/(admin)/admin/route.tsx', 'utf8')).not.toMatch(/night-audit|form-c|\/admin\/staah|STAAH/);
  });
});
