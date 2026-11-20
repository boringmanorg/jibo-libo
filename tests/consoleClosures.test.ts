import { describe, it, expect } from 'vitest';
import { closedUnits, closureFromRow, freeAfterClosures, type ClosureRow } from '@/booking/consoleClosures';
import { staticSearch } from '@/booking/staticSearch';

const block = (unit: string, start: string, end: string, at: string, units: number | null = null): ClosureRow => ({ unit, start, end, state: 'blocked', units, at });
const open = (unit: string, start: string, end: string, at: string): ClosureRow => ({ unit, start, end, state: 'open', units: null, at });

describe('console blocks on the booking page', () => {
  // The owner's sold-out nights: every room blocked 20 to 21 Nov (inclusive), in console ids.
  const soldOut = ['king-double-room', 'triple-room', '4-bed-female-only-dorm', '6-bed-mixed-dorm', '6-bed-standard-dorm', '8-bed-mixed-dorm', 'xtsy-270']
    .map((u, i) => block(u, '2026-11-20', '2026-11-21', `2026-11-20T10:0${i}:00Z`));

  it('closes every room on 20 and 21 Nov, and frees them on 22 Nov', () => {
    const r = staticSearch('2026-11-20', '2026-11-21', {}, soldOut);
    expect(r.rooms.every((x) => x.freeForStay === 0)).toBe(true);
    expect(r.fromRate).toBeNull();
    const dorm = r.rooms.find((x) => x.id === 'bed-in-8-bed-mixed-dormitory')!;
    expect(dorm.strip.slice(0, 3).map((n) => [n.night, n.closed])).toEqual([['2026-11-20', true], ['2026-11-21', true], ['2026-11-22', false]]);
    const later = staticSearch('2026-11-22', '2026-11-23', {}, soldOut);
    expect(later.rooms.every((x) => x.freeForStay > 0)).toBe(true);
  });

  it('a stay that touches a blocked night is sold out', () => {
    expect(staticSearch('2026-11-19', '2026-11-22', {}, soldOut).rooms.every((x) => x.freeForStay === 0)).toBe(true);
  });

  it('a partial block lowers the count, and the guest cannot pick more than are left', () => {
    const rows = [block('8-bed-mixed-dorm', '2026-12-01', '2026-12-01', 'a', 5)];
    const dorm = staticSearch('2026-12-01', '2026-12-02', {}, rows).rooms.find((x) => x.id === 'bed-in-8-bed-mixed-dormitory')!;
    expect(dorm.freeForStay).toBe((dorm.totalUnits ?? 0) - 5);
    expect(freeAfterClosures(rows, 'bed-in-8-bed-mixed-dormitory', '2026-12-01', 3)).toBe(0);
  });

  it('a later opening cancels an earlier block; an earlier one does not', () => {
    const rows = [block('king-double-room', '2026-12-05', '2026-12-07', '2026-11-20T10:00:00Z'), open('king-double-room', '2026-12-06', '2026-12-06', '2026-11-20T11:00:00Z')];
    expect(closedUnits(rows, 'king-room-with-mountain-view', '2026-12-05')).toBe(Infinity);
    expect(closedUnits(rows, 'king-room-with-mountain-view', '2026-12-06')).toBe(0);
    const before = [open('king-double-room', '2026-12-06', '2026-12-06', '2026-11-20T09:00:00Z'), rows[0]];
    expect(closedUnits(before, 'king-room-with-mountain-view', '2026-12-06')).toBe(Infinity);
  });

  it('reads database rows, with or without the units column', () => {
    expect(closureFromRow({ unit_type_id: 'triple-room', start_date: '2026-11-20', end_date: '2026-11-21', state: 'blocked', created_at: 'x', reason: 'Maintenance' }))
      .toEqual({ unit: 'triple-room', start: '2026-11-20', end: '2026-11-21', state: 'blocked', units: null, at: 'x' });
    expect(closureFromRow({ unit_type_id: 'triple-room', start_date: '2026-11-20', end_date: '2026-11-21', state: 'blocked', units: 1, created_at: 'x' })?.units).toBe(1);
    expect(closureFromRow({ unit_type_id: 'triple-room', state: 'weird' })).toBeNull();
  });

  it('no closures: every room open (enquiry page unchanged)', () => {
    expect(staticSearch('2026-12-01', '2026-12-02').rooms.every((x) => x.freeForStay === x.totalUnits)).toBe(true);
  });
});
