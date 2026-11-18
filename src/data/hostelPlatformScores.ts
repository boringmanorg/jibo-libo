import { GOOGLE_RATING } from './brandFacts';

/** Snapshot scores, not availability or a blended multi-platform rating. */
export const hostelPlatformScores = [
  { platform: 'Google', value: GOOGLE_RATING.value, scale: 5 },
  { platform: 'Booking.com', value: '9.4', scale: 10 },
  { platform: 'Hostelworld', value: '8.6', scale: 10 },
  { platform: 'Airbnb', value: '5.0', scale: 5 },
  { platform: 'Goibibo · MakeMyTrip', value: '4.7–4.8', scale: 5 },
  { platform: 'Agoda', value: '8.4', scale: 10 },
] as const;
