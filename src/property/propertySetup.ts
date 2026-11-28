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


/** Keep only known values, in canonical order (no free-text injection into public pages). */
export function cleanSelection(values: string[], allowed: readonly string[]): string[] {
  const set = new Set(values);
  return allowed.filter((v) => set.has(v));
}

const MAPS_HOSTS = ['maps.google.com', 'www.google.com', 'google.com', 'maps.app.goo.gl', 'goo.gl', 'g.page', 'www.google.co.in'];
/** Only https Google Maps links may be saved (they are shown to guests as a redirect). */
export function isGoogleMapsLink(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && MAPS_HOSTS.includes(u.hostname) && (u.hostname !== 'www.google.com' && u.hostname !== 'google.com' && u.hostname !== 'www.google.co.in' || u.pathname.startsWith('/maps'));
  } catch { return false; }
}

/** Read a pin from a pasted full Google Maps link (no Google request). Short links carry no pin. */
export function pinFromMapsLink(url: string): { lat: number; lng: number } | null {
  const m = url.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) ?? url.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/) ?? url.match(/[?&](?:q|query|ll)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Where "Open in Google Maps" sends guests: the saved link, else the pin, else the address. Free; no API. */
export function directionsHref(p: Pick<PropertyProfile, 'googleMapsUri' | 'latitude' | 'longitude' | 'address'>): string | null {
  if (p.googleMapsUri && isGoogleMapsLink(p.googleMapsUri)) return p.googleMapsUri;
  if (p.latitude !== null && p.longitude !== null) return `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
  if (p.address.trim()) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`;
  return null;
}
