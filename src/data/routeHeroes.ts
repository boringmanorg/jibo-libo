/**
 * Hero photos for pages whose own layout has no photo at the top (owner, 21 Nov 2026: every page
 * gets a relevant hero photo with a credit). PageShell shows the band on these addresses only;
 * pages with their own hero are left alone. Every photo here is credited (src/data/photoCredits.ts):
 * XTSY's own, or a reviewed Pexels / Wikimedia Commons photo.
 */
import { COVERS, IMG, first } from './v2Images';
import { PEXELS_PHOTOS } from './pexelsPhotos';
import { SITE_PHOTOS } from './sitePhotos';

export interface RouteHero { src: string; alt: string; position?: string }

/** Addresses that get the band (their own layout starts with text only). */
const NEEDS_HERO: RegExp[] = [
  /^\/about\/(contact|contact-us|pricing-cancellation-policy|refund-cancellation-policy|merch|privacy-policy|privacy|xtsy-facts|terms-of-service)$/,
  /^\/destinations$/,
  /^\/destinations\/[a-z0-9-]+$/,
  /^\/destinations\/[a-z0-9-]+\/[a-z0-9-]+$/,
  /^\/guides\/(best-time-to-visit-meghalaya|hidden-places-in-meghalaya|meghalaya-festivals|places-to-visit-in-meghalaya)$/,
  /^\/stays\/(homestays-in-shillong|hostel-near-me|hotels-in-shillong|partner-stays|luxury-glamping-shillong|xtsy-vs-zostel)$/,
  /^\/tours$/,
  /^\/tours\/(3-day-meghalaya-itinerary|5-day-meghalaya-itinerary|backpacking-india|budget-trip-to-meghalaya|meghalaya-couple-tour-package|meghalaya-tour-packages|plan-trip-with-ai|shillong-tour-package)$/,
  /^\/travel-guide\/(how-to-reach-meghalaya|meghalaya-for-international-tourists)$/,
];

const big = (srcs?: [number, string][]) => srcs?.find(([w]) => w >= 1280)?.[1] ?? srcs?.[srcs.length - 1]?.[1] ?? '';
const px = (key: string) => big(PEXELS_PHOTOS[key]?.srcs);
const sp = (key: string) => big(SITE_PHOTOS[key]?.srcs);
const pick = (...srcs: string[]) => srcs.find(Boolean) ?? '';
/** A reviewed photo's own description, so the alt text always says what the picture shows. */
const reviewedAltOf = (src: string) =>
  Object.values(PEXELS_PHOTOS).find((p) => p.srcs.some(([, u]) => u === src))?.alt || undefined;

/** [address test, photo, what the photo shows] — first match wins. */
const RULES: [RegExp, () => string, string][] = [
  // Northeast states and their towns
  [/\/destinations\/arunachal-pradesh\/tawang/, () => pick(px('tour-29'), IMG.arunachal), 'Tawang, Arunachal Pradesh'],
  [/\/destinations\/arunachal-pradesh\/ziro/, () => pick(sp('hero-ziro'), IMG.arunachal), 'Ziro valley, Arunachal Pradesh'],
  [/\/destinations\/arunachal-pradesh/, () => pick(px('sig-6n-7d-arunachal-pradesh-tour'), IMG.arunachal), 'Arunachal Pradesh'],
  [/\/destinations\/assam\/kaziranga/, () => pick(px('sig-7n-guwahati-shillong-kaziranga-tour'), IMG.assam), 'Kaziranga, Assam'],
  [/\/destinations\/assam\/guwahati/, () => pick(px('exp-guwahati-to-shillong'), IMG.assam), 'Guwahati, Assam'],
  [/\/destinations\/assam\/majuli/, () => pick(sp('hero-majuli'), IMG.assam), 'Majuli, Assam'],
  [/\/destinations\/assam\/jorhat/, () => pick(px('tour-22'), IMG.assam), 'Tea gardens of Upper Assam'],
  [/\/destinations\/assam/, () => pick(px('tour-22'), IMG.assam), 'Tea gardens of Assam'],
  [/\/destinations\/manipur/, () => pick(px('tour-24'), IMG.meghalaya), 'Loktak Lake, Manipur'],
  [/\/destinations\/mizoram/, () => pick(sp('hero-mizoram'), IMG.meghalaya), 'Aizawl, Mizoram'],
  [/\/destinations\/nagaland\/kohima/, () => pick(px('tour-230'), IMG.nagaland), 'Kohima, Nagaland'],
  [/\/destinations\/nagaland/, () => pick(px('tour-23'), IMG.nagaland), 'Dzukou valley, Nagaland'],
  [/\/destinations\/tripura/, () => pick(px('tour-26'), IMG.meghalaya), 'Tripura'],
  [/\/destinations\/sikkim/, () => pick(px('tour-52'), IMG.sikkim), 'Sikkim'],
  // Meghalaya towns
  [/\/destinations\/meghalaya\/cherrapunji/, () => pick(px('sig-6d-shillong-meghalaya-tour'), IMG.nohkalikai), 'Nohkalikai Falls, Cherrapunji (Sohra)'],
  [/\/destinations\/meghalaya\/dawki/, () => pick(px('tour-4'), IMG.dawki), 'The Umngot river at Dawki'],
  [/\/destinations\/meghalaya\/jowai/, () => pick(px('tour-6'), IMG.krangSuri), 'Krang Shuri waterfall, Jaintia Hills'],
  [/\/destinations\/meghalaya\/mawlynnong/, () => IMG.mawlynnong, 'Mawlynnong village'],
  [/\/destinations\/meghalaya\/mawsynram/, () => pick(sp('hero-mawsynram'), IMG.meghalaya), 'Mawsynram, East Khasi Hills'],
  [/\/destinations\/meghalaya\/nongstoin/, () => pick(sp('hero-nongstoin'), IMG.laitlum), 'West Khasi Hills, Meghalaya'],
  [/\/destinations\/meghalaya\/shillong/, () => pick(sp('hero-shillong'), IMG.umiam), 'Shillong, Meghalaya'],
  [/\/destinations\/meghalaya\/tura/, () => pick(sp('hero-tura'), IMG.meghalaya), 'Tura, Garo Hills'],
  [/\/destinations(\/meghalaya)?$/, () => pick(px('sig-6n-7d-meghalaya-tour'), IMG.meghalaya), 'Meghalaya hills'],
  // Guides, tours and travel help
  [/best-time-to-visit|meghalaya-festivals/, () => pick(px('tour-8'), IMG.sevenSisters), 'Waterfalls of Meghalaya'],
  [/hidden-places/, () => pick(px('exp-meghalaya-loop'), IMG.laitlum), 'Hills and valleys of Meghalaya'],
  [/places-to-visit-in-meghalaya/, () => pick(px('sig-6d-shillong-meghalaya-tour'), IMG.nohkalikai), 'Nohkalikai Falls, Meghalaya'],
  [/couple-tour|luxury-glamping/, () => first(IMG.suite), 'Experience by XTSY, the glass suite at XTSY Travellers Hostel'],
  [/backpacking-india|hostel-near-me/, () => first(IMG.mixedDorm) || COVERS.commonRoom, 'Dormitory at XTSY Travellers Hostel'],
  [/budget-trip/, () => pick(px('tour-4'), IMG.dawki), 'The Umngot river at Dawki'],
  [/3-day-meghalaya|shillong-tour-package/, () => pick(px('sig-4n-5d-shillong-meghalaya-tour'), IMG.umiam), 'Umiam Lake near Shillong'],
  [/5-day-meghalaya|meghalaya-tour-packages/, () => pick(sp('sig-5d-meghalaya-trip-package'), px('tour-1'), IMG.rootBridge), 'Double-decker living root bridge, Nongriat'],
  [/plan-trip-with-ai/, () => pick(px('exp-meghalaya-loop'), IMG.laitlum), 'Hills and valleys of Meghalaya'],
  [/^\/tours$/, () => pick(px('sig-6n-7d-meghalaya-tour'), IMG.meghalaya), 'Meghalaya hills'],
  [/how-to-reach|international-tourists/, () => pick(px('exp-guwahati-to-shillong'), IMG.umiam), 'The road from Guwahati to Shillong'],
  // Stays and company pages: XTSY Travellers Hostel itself
  [/homestays|hotels-in-shillong|partner-stays/, () => COVERS.terrace, 'XTSY Travellers Hostel, New Shillong Township'],
  [/xtsy-vs-zostel/, () => COVERS.commonRoom, 'Common room at XTSY Travellers Hostel'],
  [/\/about\/merch/, () => COVERS.workation, 'XTSY Travellers Hostel'],
  [/\/about\/contact/, () => COVERS.contact, 'XTSY Travellers Hostel, New Shillong Township'],
  [/\/about\//, () => COVERS.about, 'XTSY Travellers Hostel, New Shillong Township'],
];

export function routeHero(pathname: string): RouteHero | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (!NEEDS_HERO.some((re) => re.test(path))) return null;
  for (const [re, photo, alt] of RULES) {
    if (!re.test(path)) continue;
    const src = photo();
    if (src && !src.endsWith('placeholder.svg')) return { src, alt: reviewedAltOf(src) ?? alt };
  }
  return null;
}
