import { describe, it, expect } from 'vitest';
import { nextSaturdayDepartures, SATURDAY_GROUP_TOUR } from '@/data/saturdayGroupTour';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('Saturday group tour', () => {
  it('departs only on the 1st and 3rd Saturday of each month', () => {
    const dates = nextSaturdayDepartures(new Date(2026, 10, 12), 6).map(ymd);
    expect(dates).toEqual(['2026-11-21', '2026-12-05', '2026-12-19', '2027-01-02', '2027-01-16', '2027-02-06']);
  });
  it('includes the departure day itself', () => {
    expect(ymd(nextSaturdayDepartures(new Date(2026, 10, 7), 1)[0])).toBe('2026-11-07');
  });
  it('costs ₹10,000 per person for 4N/5D with a minimum of 4', () => {
    expect(SATURDAY_GROUP_TOUR.pricePerPerson).toBe(10000);
    expect(SATURDAY_GROUP_TOUR.duration).toBe('4 Nights / 5 Days');
    expect(SATURDAY_GROUP_TOUR.minGroup).toBe(4);
  });
});
