import { describe, expect, it } from 'vitest';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { feedRoomTypes, unitsOnFloor } from '@/booking/pmsFeed';

describe('PMS feed', () => {
  it('lists every room type with as many beds or rooms as it sells', () => {
    const types = feedRoomTypes();
    expect(types.map((t) => t.id)).toEqual(BOOKING_ROOM_TYPES.map((t) => t.id));
    for (const t of types) {
      expect(t.unitsOnFloor).toHaveLength(t.units);
      expect(new Set(t.unitsOnFloor.map((u) => u.label)).size).toBe(t.units);
      expect(t.rate).toBeGreaterThan(0);
    }
  });
  it('uses floor labels when known and spreads dorm beds over the sheet rooms otherwise', () => {
    const byId = Object.fromEntries(BOOKING_ROOM_TYPES.map((t) => [t.id, t]));
    expect(unitsOnFloor(byId['bed-in-8-bed-mixed-dormitory']!)[0]).toEqual({ label: '8A', room: 'Room 8' });
    expect(unitsOnFloor(byId['experience-by-xtsy']!)).toEqual([{ label: '666', room: '666' }]);
    const std = unitsOnFloor(byId['bed-in-6-bed-standard-dormitory']!);
    expect(std.filter((u) => u.room === 'Room 2')).toHaveLength(7);
    expect(std.filter((u) => u.room === 'Room 3')).toHaveLength(7);
    expect(unitsOnFloor(byId['king-room-with-mountain-view']!).map((u) => u.label)).toEqual(['1', '6']);
  });
  it('gives rates in rupees', () => {
    expect(feedRoomTypes().find((t) => t.id === 'experience-by-xtsy')!.rate).toBe(4999);
  });
});
