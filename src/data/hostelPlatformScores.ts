import { GOOGLE_RATING } from './brandFacts';

/** Snapshot scores, not availability or a blended multi-platform rating. */
export const hostelPlatformScores = [
  { platform: 'Google', value: GOOGLE_RATING.value, scale: 5, count: GOOGLE_RATING.count, note: 'Google reviews' },
  { platform: 'Booking.com', value: '9.4', scale: 10, note: 'Historical score · not currently listed' },
  { platform: 'Hostelworld', value: '8.6', scale: 10, count: 3, note: 'Checked 17 Nov 2026' },
  { platform: 'Airbnb', value: '5.0', scale: 5, count: 3, note: 'Hostel listing · checked 18 Nov 2026' },
  { platform: 'Goibibo', value: '4.7', scale: 5, note: 'Owner-reported score' },
  { platform: 'MakeMyTrip', value: '4.8', scale: 5, note: 'Search-result rating · not confirmed on listing' },
  { platform: 'Agoda', value: '8.4', scale: 10, count: 32, note: 'Checked 18 Nov 2026' },
] as const;