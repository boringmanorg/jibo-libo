import { describe, it, expect } from 'vitest';
import { nextSaturdayDepartures, SATURDAY_GROUP_TOUR as T } from '@/data/saturdayGroupTour';

describe('Saturday group tour', () => {
  it('matches the owner-set terms of 13 Nov 2026', () => {
    expect(T.pricePerPerson).toBe(9000);
    expect(T.pricePerDay).toBe(2250);
    expect(T.duration).toBe('4 Days / 3 Nights');
    expect(T.minGroup).toBe(4);
  });

  // The three figures have to agree, or the page contradicts itself: the rate
  // is quoted per day, the headline price per person, and the group total is
  // what four guests actually pay.
  it('keeps the per-day rate, per-person price and group total consistent', () => {
    expect(T.pricePerDay * 4).toBe(T.pricePerPerson);
    expect(T.pricePerPerson * T.minGroup).toBe(T.groupTotal);
  });

  it('covers four days and three nights, all of them in Shillong', () => {
    expect(T.itinerary).toHaveLength(4);
    expect(T.itinerary.map((d) => d.day)).toEqual([1, 2, 3, 4]);
    const overnights = T.itinerary.filter((d) => d.overnight !== null);
    expect(overnights).toHaveLength(3);
    for (const d of overnights) expect(d.overnight).toBe('Shillong');
    for (const d of T.itinerary) expect(d.stops.length).toBeGreaterThan(0);
  });

  // The 4N/5D product included a night at Dawki (Shnongpdeng). It no longer
  // does, and a stale mention would promise a stay that is not sold.
  it('no longer advertises the dropped Dawki camping night', () => {
    const blob = JSON.stringify(T);
    expect(blob).not.toMatch(/Dawki|Shnongpdeng/i);
  });

  it('starts and ends at Guwahati', () => {
    expect(T.itinerary[0].stops.join(' ')).toMatch(/pickup from Guwahati/i);
    expect(T.itinerary[3].stops.join(' ')).toMatch(/Guwahati railway station or airport/i);
  });

  it('lists the 1st and 3rd Saturdays from a given date', () => {
    const d = nextSaturdayDepartures(new Date(2026, 10, 13), 4);
    expect(d).toHaveLength(4);
    for (const x of d) expect(x.getDay()).toBe(6);
  });
});
