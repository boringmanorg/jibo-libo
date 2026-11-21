import { describe, expect, it } from 'vitest';
import { LISTING_LOGOS, SOCIAL_LOGOS } from '../src/data/platformLogos';

describe('Brand logo presence strips', () => {
  it('never turns a listing logo into a redirect off xtsy.one', () => {
    expect(LISTING_LOGOS.map((l) => l.name)).toEqual([
      'Google', 'Tripadvisor', 'Booking.com', 'Hostelworld', 'Expedia', 'Agoda', 'MakeMyTrip', 'Goibibo', 'Airbnb',
    ]);
    expect(LISTING_LOGOS.every((l) => !l.href)).toBe(true);
  });

  it('keeps the social strip links to the owned channels', () => {
    expect(SOCIAL_LOGOS.find((l) => l.name === 'Instagram')?.href).toContain('instagram.com/xtsy.one');
    expect(SOCIAL_LOGOS.find((l) => l.name === 'YouTube')?.href).toContain('youtube.com/@voyagebyxtsy');
  });
});
