import { describe, expect, it } from 'vitest';
import { GOOGLE_RATING, BISTRO_GOOGLE_RATING } from '../src/data/brandFacts';
import { hostelPlatformScores } from '../src/data/hostelPlatformScores';
import { hostelOtaReviews } from '../src/data/hostelOtaReviews';
import { bistroGoogleReviews } from '../src/data/bistroGoogleReviews';

describe('Separate listing scores', () => {
  it('retains the hostel Google score and total', () => {
    expect([GOOGLE_RATING.value, GOOGLE_RATING.count]).toEqual(['4.7', 252]);
  });
  it('uses Bistro Google figures rather than its featured-review average', () => {
    expect([BISTRO_GOOGLE_RATING.value, BISTRO_GOOGLE_RATING.count]).toEqual(['4.7', 34]);
    expect(bistroGoogleReviews).toHaveLength(23);
  });
  it('keeps the historical Booking.com score separate from current availability', () => {
    expect(hostelPlatformScores.find((r) => r.platform === 'Booking.com')).toMatchObject({ value: '9.4', scale: 10, note: 'Historical score · not currently listed' });
  });
  it('shows the hostel Airbnb score from its three reviews, not the suite listing', () => {
    expect(hostelPlatformScores.find((r) => r.platform === 'Airbnb')).toMatchObject({ value: '5.0', scale: 5, count: 3 });
    expect(hostelOtaReviews.filter((r) => r.source === 'Airbnb')).toHaveLength(3);
  });
  it('preserves low-rated feedback and original Agoda ten-point scale', () => {
    expect(hostelOtaReviews.find((r) => r.name === 'Parth')).toMatchObject({ rating: 2.4, ratingScale: 10, source: 'Agoda' });
    expect(hostelOtaReviews.find((r) => r.name === 'Kandarp')).toMatchObject({ rating: 9.2, ratingScale: 10 });
  });
});