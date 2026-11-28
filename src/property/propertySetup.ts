/** Browser-safe property setup vocabulary shared by the console and /book. */
export const PROPERTY_TYPES = ['Hotel', 'Homestay', 'Hostel', 'Motel', 'Camping'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const AMENITIES = [
  'Free Wi-Fi', 'Hot water', 'Parking', 'Restaurant on site', 'Breakfast available', 'Lockers', 'Common lounge',
  'Shared kitchen', 'Laundry', 'Power backup', 'Mountain view', 'River view', 'Bonfire area', 'Tents provided',
  'Washrooms', 'CCTV in common areas', '24/7 front desk', 'Workspace', 'Luggage storage', 'Pet friendly',
] as const;

/** Platforms the property can declare it is listed on. Shown as logos only, never links. */
export const OTA_PLATFORMS = ['Google', 'Tripadvisor', 'Booking.com', 'Hostelworld', 'Expedia', 'Agoda', 'MakeMyTrip', 'Goibibo', 'Airbnb'] as const;

export type GoogleReview = { author: string; rating: number; text: string; when: string };

export type PropertyProfile = {
  propertyId: string;
  propertyType: PropertyType;
  displayName: string;
  description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  googleMapsUri: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  googleReviews: GoogleReview[];
  googleSyncedAt: string | null;
  amenities: string[];
  otaPresence: string[];
  hiddenRoomTypes: string[];
};

export type PlaceHit = { placeId: string; name: string; address: string };

/** Keep only known values, in canonical order (no free-text injection into public pages). */
export function cleanSelection(values: string[], allowed: readonly string[]): string[] {
  const set = new Set(values);
  return allowed.filter((v) => set.has(v));
}
