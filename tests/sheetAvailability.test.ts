import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { aggregateSheet, sheetCapacity, SHEET_ROOM_NUMBERS } from '@/booking/sheetAvailability';
import { staticSearch } from '@/booking/staticSearch';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';

// The Apps Script's parser, loaded from the .gs file the owner pastes into the sheet.
const gs = readFileSync('scripts/google-sheet/availability-sync.gs', 'utf8');
const parseRoomManagement = new Function(`${gs}; return parseRoomManagement;`)() as (v: string[][], today: string, n: number) => { roomNo: string; night: string; free: number }[];

/** One month block laid out like the owner's sheet: [free, note] pairs after "Current AVL" / "MM/DD". */
function block(label: string, mm: string, days: number, rooms: [string, string, (day: number) => number][]) {
  const header = ['XTSY Travellers Hostel', 'Room Number', ''];
  for (let d = 1; d <= days; d++) header.push('Current AVL', `${mm}/${String(d).padStart(2, '0')}`);
  const rows: string[][] = [[label], header];
  rooms.forEach(([name, no, free], i) => {
    if (i === 8) rows.push(['XTSY Travellers Hostel', 'Room Number', '', ...Array.from({ length: days }, () => ['Current AVL', '']).flat()]);
    const r = [name, no, ''];
    for (let d = 1; d <= days; d++) { const f = free(d); r.push(String(f), f === 0 ? 'guest note' : ''); }
    rows.push(r);
  });
  return rows;
}

// December 2026 as read from the owner's sheet on 21 Nov 2026 (13 Dec: a group in almost every room).
const dec13 = (full: number) => (d: number) => (d === 13 ? 0 : full);
const DEC = block('December 2026', '12', 31, [
  ['Bed in 4 Bed Female Dormitory', '9', dec13(1)],
  ['Bed in 4 Bed Female Dormitory', '10', () => 0],
  ['Bed in 6 Bed Mixed Dormitory', '4', dec13(6)],
  ['Bed in 6 Bed Mixed Dormitory', '5', dec13(6)],
  ['Bed in 6 Bed Mixed Standard Dormitory', '2', dec13(7)],
  ['Bed in 6 Bed Mixed Standard Dormitory', '3', dec13(7)],
  ['Bed in 6 Bed Mixed Dormitory', '7', dec13(6)],
  ['Bed in 8 Bed Mixed Dormitory', '8', dec13(8)],
  ['King Room with Mountain View', '1', dec13(1)],
  ['King Room with Mountain View', '6', dec13(1)],
  ['Triple Room with Mountain View', '11', dec13(1)],
  ['Experience by XTSY', '666', () => 1],
]);
const FEB = block('February 2027', '02', 28, [
  ['Bed in 4 Bed Female Dormitory', '9', () => 1], ['Bed in 4 Bed Female Dormitory', '10', () => 0],
  ['Bed in 6 Bed Mixed Dormitory', '4', () => 6], ['Bed in 6 Bed Mixed Dormitory', '5', () => 6],
  ['Bed in 6 Bed Mixed Standard Dormitory', '2', () => 7], ['Bed in 6 Bed Mixed Standard Dormitory', '3', () => 7],
  ['Bed in 6 Bed Mixed Dormitory', '7', () => 6], ['Bed in 8 Bed Mixed Dormitory', '8', () => 8],
  ['King Room with Mountain View', '1', () => 1], ['King Room with Mountain View', '6', () => 1],
  ['Triple Room with Mountain View', '11', () => 1], ['Experience by XTSY', '666', () => 1],
]);
// An older block whose label has no year must be skipped, not read as the month before it.
const OLD = [['February '], ['XTSY Travellers Hostel', 'Room Number', '', 'Current AVL', '02/01'], ['8 Bed Dorm', '8', '', '3', '']];

describe('Google Sheet availability (Room Management tab)', () => {
  const cells = parseRoomManagement([...OLD, [], ...DEC, ...FEB], '2026-11-21', 240);
  const { availability, unknownRooms } = aggregateSheet(cells as never);

  it('reads the count to the left of each MM/DD date, only from today, never notes', () => {
    expect(cells.every((c) => c.night >= '2026-11-21' && Number.isInteger(c.free))).toBe(true);
    expect(cells.some((c) => c.night.startsWith('2026-02'))).toBe(false);
    expect(JSON.stringify(cells)).not.toMatch(/guest note/);
    expect(unknownRooms).toEqual([]);
  });

  it('13 Dec 2026: everything full except Experience by XTSY', () => {
    const n = '2026-12-13';
    expect(Object.fromEntries(Object.entries(availability).map(([id, v]) => [id, v[n]]))).toEqual({
      'bed-in-4-bed-female-deluxe-dormitory': 0, 'bed-in-6-bed-mixed-dormitory': 0, 'bed-in-6-bed-standard-dormitory': 0,
      'bed-in-8-bed-mixed-dormitory': 0, 'king-room-with-mountain-view': 0, 'triple-room-with-mountain-view': 0, 'experience-by-xtsy': 1,
    });
    const r = staticSearch('2026-12-13', '2026-12-14', {}, [], availability);
    expect(r.rooms.filter((x) => x.freeForStay > 0).map((x) => x.id)).toEqual(['experience-by-xtsy']);
  });

  it('2 Feb 2027: long-stay guests in rooms 9 and 10 leave 1 female bed; standard dorms have 14 with the extra beds', () => {
    const n = '2027-02-02';
    expect(availability['bed-in-4-bed-female-deluxe-dormitory'][n]).toBe(1);
    expect(availability['bed-in-6-bed-mixed-dormitory'][n]).toBe(18);
    expect(availability['bed-in-6-bed-standard-dormitory'][n]).toBe(14);
    expect(availability['bed-in-8-bed-mixed-dormitory'][n]).toBe(8);
    expect(availability['king-room-with-mountain-view'][n]).toBe(2);
    const four = staticSearch('2027-02-02', '2027-02-03', {}, [], availability).rooms.find((x) => x.id === 'bed-in-4-bed-female-deluxe-dormitory')!;
    expect(four.freeForStay).toBe(1);
  });

  it('a stay over 12–14 Dec is limited by the full night', () => {
    const r = staticSearch('2026-12-12', '2026-12-15', {}, [], availability);
    expect(r.rooms.find((x) => x.id === 'bed-in-8-bed-mixed-dormitory')!.freeForStay).toBe(0);
  });

  it('nights the sheet has not sent fall back to the full room count; console blocks still apply on top', () => {
    expect(sheetCapacity(availability, 'bed-in-8-bed-mixed-dormitory', '2027-12-01', 8)).toBe(8);
    const blocked = staticSearch('2027-02-02', '2027-02-03', {}, [{ unit: '8-bed-mixed-dorm', start: '2027-02-02', end: '2027-02-02', state: 'blocked', units: 3, at: 'a' }], availability);
    expect(blocked.rooms.find((x) => x.id === 'bed-in-8-bed-mixed-dormitory')!.freeForStay).toBe(5);
  });

  it('every sheet room number maps to a real booking room type', () => {
    const ids = new Set(BOOKING_ROOM_TYPES.map((r) => r.id));
    expect(Object.values(SHEET_ROOM_NUMBERS).every((id) => ids.has(id))).toBe(true);
  });
});
