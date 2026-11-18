import { MOVED_PAGES } from './movedPages';

/**
 * Old addresses that permanently forward elsewhere. Served as 301s by src/server.ts
 * before rendering, so they need no page file and stay out of the editor page list.
 */
const RETIRED: Record<string, string> = {
  '/3-day-meghalaya-itinerary': '/tours/3-day-meghalaya-itinerary',
  '/4x4-expedition-meghalaya': '/tours/4x4-expedition-meghalaya',
  '/5-day-meghalaya-itinerary': '/tours/5-day-meghalaya-itinerary',
  '/adventure-tours-northeast-india': '/tours/adventure-tours-northeast-india',
  '/auth': '/',
  '/best-hostel-in-shillong': '/stays/best-hostel-in-shillong',
  '/book-hostel-shillong': '/hostel-booking',
  '/budget-trip-to-meghalaya': '/tours/budget-trip-to-meghalaya',
  '/cheap-hostel-in-shillong': '/budget-hostels-shillong',
  '/cheap-hostel-shillong': '/budget-hostels-shillong',
  '/cheap-hostels-shillong': '/budget-hostels-shillong',
  '/destination-wedding-shillong': '/tours/destination-wedding-shillong',
  '/experience-by-xtsy': '/stays/experience-by-xtsy',
  '/female-travellers': '/stays/female-travellers',
  '/franchise': '/',
  '/franchise/install': '/',
  '/franchise/login': '/',
  '/group-bookings-meghalaya': '/stays/group-bookings-meghalaya',
  '/homestays-in-shillong': '/stays/homestays-in-shillong',
  '/hostel-near-me': '/stays/hostel-near-me',
  '/hotels-in-shillong': '/stays/hotels-in-shillong',
  '/luxury-glamping-shillong': '/stays/luxury-glamping-shillong',
  '/meghalaya-adventure-tour': '/tours/meghalaya-adventure-tour',
  '/meghalaya-couple-tour-package': '/tours/meghalaya-couple-tour-package',
  '/meghalaya-tour-packages': '/tours/meghalaya-tour-packages',
  '/motorbike-expedition-northeast-india': '/tours/motorbike-expedition-northeast-india',
  '/partner-stays': '/stays/partner-stays',
  '/pet-friendly': '/stays/pet-friendly',
  '/profile': '/',
  '/rentals': '/tours/xtsy-rentals',
  '/restaurant-in-shillong': '/tab-bistro',
  '/shillong-tour-package': '/tours/shillong-tour-package',
  '/tab-bistro/catering': '/catering-shillong',
  '/terms': '/terms-of-service',
  '/work-from-home': '/stays/workation',
  '/xtsy-270': '/stays/experience-by-xtsy',
  '/xtsy-adventure-campsite-dawki': '/stays/campsite-dawki',
  '/xtsy-rentals': '/tours/xtsy-rentals',
};

export const LEGACY_REDIRECTS: Record<string, string> = { ...RETIRED, ...MOVED_PAGES };

export function legacyRedirectTarget(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return LEGACY_REDIRECTS[clean] ?? null;
}
