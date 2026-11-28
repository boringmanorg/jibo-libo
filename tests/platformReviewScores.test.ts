import { describe, expect, it } from 'vitest';
import { GOOGLE_RATING, BISTRO_GOOGLE_RATING } from '../src/data/brandFacts';
import { hostelPlatformScores } from '../src/data/hostelPlatformScores';
import { hostelOtaReviews } from '../src/data/hostelOtaReviews';
import { bistroGoogleReviews } from '../src/data/bistroGoogleReviews';

describe('Separate listing scores', () => {
  it('retains the hostel Google score and total', () => {
    expect([GOOGLE_RATING.value, GOOGLE_RATING.count]).toEqual(['4.7', 256]);
  });
  it('uses Bistro Google figures rather than its featured-review average', () => {
    expect([BISTRO_GOOGLE_RATING.value, BISTRO_GOOGLE_RATING.count]).toEqual(['4.7', 34]);
    expect(bistroGoogleReviews).toHaveLength(23);
  });
  it('keeps the Booking.com score without notes or review totals', () => {
    expect(hostelPlatformScores.find((r) => r.platform === 'Booking.com')).toEqual({ platform: 'Booking.com', value: '9.4', scale: 10 });
    expect(hostelPlatformScores.every((r) => !('note' in r) && !('count' in r))).toBe(true);
  });
  it('keeps Goibibo and MakeMyTrip as separate rows and leaves Google to the headline', () => {
    expect(hostelPlatformScores.find((r) => r.platform === 'Goibibo')).toEqual({ platform: 'Goibibo', value: '4.7', scale: 5 });
    expect(hostelPlatformScores.find((r) => r.platform === 'MakeMyTrip')).toEqual({ platform: 'MakeMyTrip', value: '4.8', scale: 5 });
    expect(hostelPlatformScores.some((r) => r.platform === 'Google')).toBe(false);
  });
  it('shows the hostel Airbnb score, not the suite listing', () => {
    expect(hostelPlatformScores.find((r) => r.platform === 'Airbnb')).toMatchObject({ value: '5.0', scale: 5 });
    expect(hostelOtaReviews.filter((r) => r.source === 'Airbnb')).toHaveLength(3);
  });
  it('shows owner-approved Tripadvisor and Expedia scores on their own scales', () => {
    expect(hostelPlatformScores.find((r) => r.platform === 'Tripadvisor')).toEqual({ platform: 'Tripadvisor', value: '5.0', scale: 5 });
    expect(hostelPlatformScores.find((r) => r.platform === 'Expedia')).toEqual({ platform: 'Expedia', value: '8.0', scale: 10 });
  });
  it('preserves low-rated feedback and original Agoda ten-point scale', () => {
    expect(hostelOtaReviews.find((r) => r.name === 'Parth')).toMatchObject({ rating: 2.4, ratingScale: 10, source: 'Agoda' });
    expect(hostelOtaReviews.find((r) => r.name === 'Kandarp')).toMatchObject({ rating: 9.2, ratingScale: 10 });
  });
});