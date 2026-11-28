import { describe, expect, it } from 'vitest';
import { floorLabels, lastNight, validateAllocation } from '@/checkin/allocation';

const base = { roomTypeId: 'bed-in-8-bed-mixed-dormitory', checkIn: '2026-12-01', checkOut: '2026-12-03' };

describe('desk room allocation', () => {
  it('lists the 8-bed dorm beds', () => { expect(floorLabels(base.roomTypeId)).toContain('8A'); });
  it('needs one dorm bed per guest', () => {
    expect(() => validateAllocation({ ...base, units: ['8A'], guests: 2 }, [])).toThrow(/at least 2/);
    expect(() => validateAllocation({ ...base, units: ['8A', '8B'], guests: 2 }, [])).not.toThrow();
  });
  it('refuses a bed already given on overlapping nights', () => {
    const other = { id: 'x', roomTypeId: base.roomTypeId, units: ['8A'], checkIn: '2026-12-02', checkOut: '2026-12-04' };
    expect(() => validateAllocation({ ...base, units: ['8A'], guests: 1 }, [other])).toThrow(/already/);
  });
  it('frees a bed on the other guest\'s check-out day', () => {
    const other = { id: 'x', roomTypeId: base.roomTypeId, units: ['8A'], checkIn: '2026-11-29', checkOut: '2026-12-01' };
    expect(() => validateAllocation({ ...base, units: ['8A'], guests: 1 }, [other])).not.toThrow();
  });
  it('rejects a bed from another room type', () => {
    expect(() => validateAllocation({ ...base, units: ['666'], guests: 1 }, [])).toThrow(/not part/);
  });
  it('holds through the night before check-out', () => { expect(lastNight('2026-12-03')).toBe('2026-12-02'); });
});
