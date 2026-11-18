/**
 * Single source of truth for ALL resolvable URL slugs in the app.
 *
 * Used by:
 *  1. The build-time slug audit (`scripts/auditSlugs.ts`) — flags any slug
 *     referenced in nav/content that doesn't resolve to a real page.
 *  2. The auto sitemap generator (`scripts/generateSitemaps.ts`).
 *  3. The admin coverage dashboard.
 */
import { ALL_SEO_PAGES } from '@/data/seoPages';
import { RECOVERY_REDIRECTS } from '@/data/seoAffectedSlugs';
import { EXPEDITION_ROUTES } from '@/data/neTaxonomy';

/** Hand-coded React Router routes (kept in sync with App.tsx). */
export const STATIC_ROUTES: ReadonlyArray<string> = [
  '/',
  '/about',
  '/about/xtsy-facts',
  '/tours',
  '/stays/experience-by-xtsy',
  '/stays/pet-friendly',
  '/stays/xtsy-vs-zostel',
  '/stays/female-travellers',
  '/about/faq',
  '/about/safety-house-rules',
  '/stays/workation',
  '/tours/xtsy-rentals',
  '/tab-bistro',
  '/stays/campsite-dawki',
  '/about/privacy-policy',
  '/about/terms-of-service',
  '/about/pricing-cancellation-policy',
  '/book',
  
  '/guides/things-to-do-in-meghalaya',
  '/guides/meghalaya-waterfalls',
  '/guides/meghalaya-caves',
  '/guides/meghalaya-villages',
  '/guides/meghalaya-viewpoints',
  '/tours/meghalaya-tour-packages',
  '/expeditions',
  '/tours/adventure-tours-northeast-india',
  '/tours/meghalaya-adventure-tour',
  '/tours/motorbike-expedition-northeast-india',
  '/tours/4x4-expedition-meghalaya',
  '/about/merch',
  '/tours/plan-trip-with-ai',
  '/stays/group-bookings-meghalaya',
  '/tours/meghalaya-couple-tour-package',
  '/tours/shillong-tour-package',
  '/guides/best-time-to-visit-meghalaya',
  '/guides/hidden-places-in-meghalaya',
  '/tours/3-day-meghalaya-itinerary',
  '/tours/5-day-meghalaya-itinerary',
  '/tours/budget-trip-to-meghalaya',
  '/guides/meghalaya-photo-gallery',
  '/stays/best-hostel-in-shillong',
  '/stays/budget-hostels-shillong',
  '/stays/hotels-in-shillong',
  '/stays/homestays-in-shillong',
  '/stays/luxury-glamping-shillong',
  '/tours/destination-wedding-shillong',
  '/tab-bistro',
  '/stays/hostel-booking',
  '/about/contact',
  '/guides',
  '/guides/meghalaya-festivals',
  '/stays/partner-stays',
  '/tours/backpacking-india',
  '/guides/places-to-visit-in-meghalaya',
  '/tab-bistro/catering',
  '/travel-guide/guwahati-to-shillong-transport',
  '/travel-guide/how-to-reach-meghalaya',
  '/travel-guide/meghalaya-for-international-tourists',
  '/stays/hostel-near-me',
  // Every route detail is data-driven; keep all valid type × route paths in the sitemap.
  ...EXPEDITION_ROUTES.flatMap((route) => route.types.map((type) => `/expeditions/${type}/${route.slug}`)),
];

/** Returns true if `path` resolves to a real React route, programmatic SEO
 *  page, or an active redirect. */
export function isResolvable(path: string): boolean {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (STATIC_ROUTES.includes(normalized)) return true;

  const slug = normalized.replace(/^\//, '').split('/')[0];
  if (!slug) return true;

  // Programmatic SEO entry?
  if (ALL_SEO_PAGES.some(p => p.slug === slug)) return true;

  // Recovery redirect?
  if (Object.prototype.hasOwnProperty.call(RECOVERY_REDIRECTS, slug)) return true;

  // places-to-visit/* dynamic
  if (normalized.startsWith('/places-to-visit/')) return true;
  // tours/* dynamic
  if (normalized.startsWith('/tours/')) return true;
  if (normalized.startsWith('/expeditions/')) return true;

  return false;
}

export interface SlugAuditResult {
  totalReferenced: number;
  resolved: number;
  unresolved: string[];
}

/** Audit a list of slugs against the registry. Used by the build script. */
export function auditSlugs(slugs: string[]): SlugAuditResult {
  const unresolved: string[] = [];
  for (const s of slugs) {
    if (!isResolvable(s)) unresolved.push(s);
  }
  return {
    totalReferenced: slugs.length,
    resolved: slugs.length - unresolved.length,
    unresolved,
  };
}
