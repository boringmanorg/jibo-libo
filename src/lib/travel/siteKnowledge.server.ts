/**
 * What the Claude trip assistant knows about XTSY, built from the same data files the pages use,
 * so a price or policy change on the site reaches the assistant with the next deploy. Server only.
 */
import { BRAND, GOOGLE_RATING, PROPERTY_ADDRESS } from '@/data/brandFacts';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { RATE_BASIS_LONG } from '@/data/publicRates';
import { BOOKING_POLICY_ANSWER, HOSTEL_POLICIES } from '@/data/hostelPolicies';
import { PANORAMA_DECORATION, gstPercentFor } from '@/data/panoramaPricing';
import { STARGAZING_NOTICE } from '@/data/stargazingPolicy';
import { CAMP, CAMP_GST_NOTE, CAMP_MEALS, CAMP_PLANS, CAMP_TENTS } from '@/data/shnonpedengCamp';
import { BISTRO_HOURS_SENTENCE } from '@/data/tabBistroHours';
import { MENU_GST_NOTE } from '@/data/tabBistroMenu';
import { BREAKFAST_ITEMS } from '@/data/breakfastMenu';
import { BIKES, CARS } from '@/data/rentalFleet';
import { SIGNATURE_PACKAGES } from '@/data/signaturePackages';
import { getAllTours } from '@/data/travelData';
import { hostelDealFaqs } from '@/data/hostelBookingFaqs';
import sitePages from '../../../public/search-pages.json';

export interface SitePageRow { u: string; t: string; d: string; s: string }
export const SITE_PAGES = sitePages as SitePageRow[];
const LIVE = new Set(SITE_PAGES.map((p) => p.u));

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const toSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function build(): string {
  const rooms = BOOKING_ROOM_TYPES.map((r) =>
    `- ${r.name}${r.descriptor ? ` (${r.descriptor})` : ''}: ${inr(r.rate / 100)} ${r.soldAs === 'bed' ? 'a bed' : 'a room'} a night, up to ${r.maxGuestsPerUnit} guest${r.maxGuestsPerUnit > 1 ? 's' : ''}${r.femaleOnly ? ', women only' : ''}; GST ${gstPercentFor(r.rate / 100)}% extra`).join('\n');
  const breakfast = BREAKFAST_ITEMS.map((i) => `${i.name} ${inr(i.price)}`).join('; ');
  const cars = CARS.map((c) => `${c.name} ${c.price ? inr(c.price) : 'on request'}/day (${c.specs.join(', ')})`).join('; ');
  const bikes = BIKES.map((b) => `${b.name} ${b.price ? inr(b.price) : 'on request'}/day`).join('; ');
  const signature = SIGNATURE_PACKAGES.map((p) =>
    `- ${p.title} — ${p.duration}, ${inr(p.pricePerPerson)} a person (min ${p.minGroup}), ${p.region}, pickup ${p.pickupDrop}: /tours/${p.slug}`).join('\n');
  const tours = getAllTours()
    .map((t) => ({ t, u: `/tours/${toSlug(t.title)}` }))
    .filter(({ u }) => LIVE.has(u))
    .map(({ t, u }) => `- ${t.title} — ${t.duration}, ${t.price}, ${t.location}: ${u}`).join('\n');
  const faqs = hostelDealFaqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n');

  return `# XTSY facts (source of truth; never contradict these)

## XTSY Travellers Hostel™
- Address: ${PROPERTY_ADDRESS}.
- Check-in ${HOSTEL_POLICIES.checkIn}, check-out ${HOSTEL_POLICIES.checkOut}, quiet hours ${HOSTEL_POLICIES.quietHours}.
- Google rating ${GOOGLE_RATING.label}. WhatsApp desk ${BRAND.whatsappDisplay}.
- Experience by XTSY™ (the premium couple en-suite with a 270° glass room) is part of XTSY Travellers Hostel. Optional decoration ${inr(PANORAMA_DECORATION)} plus GST.
- Stargazing: ${STARGAZING_NOTICE}

Rooms (${RATE_BASIS_LONG}):
${rooms}
Book and see live availability at /book. Booking policy: ${BOOKING_POLICY_ANSWER}

## TAB Bistro™ (restaurant at the hostel)
${BISTRO_HOURS_SENTENCE} ${MENU_GST_NOTE}
Breakfast is ordered item by item from the menu (there is no fixed breakfast price); guests can add items when booking a stay. Breakfast and beverage items: ${breakfast}. Full menu: /tab-bistro

## ${CAMP.name} (Shnonpedeng, near Dawki)
${CAMP.partnerLine}; ${CAMP.where}. ${CAMP_TENTS} tents.
- ${CAMP_PLANS.tent.title}: ${inr(CAMP_PLANS.tent.price)} ${CAMP_PLANS.tent.unit}. ${CAMP_PLANS.tent.line}
- ${CAMP_PLANS.bed.title}: ${inr(CAMP_PLANS.bed.price)} ${CAMP_PLANS.bed.unit}. ${CAMP_PLANS.bed.line}
- Meals: ${Object.values(CAMP_MEALS).map((m) => `${m.title} ${inr(m.price)} ${m.unit}`).join('; ')}. ${CAMP.mealsNote}
- ${CAMP_GST_NOTE} Booking page: /stays/campsite-dawki (book at /book?location=shnonpedeng).

## XTSY Rentals (self-drive, from the hostel): /tours/xtsy-rentals
Cars, all petrol except the Innova Crysta (diesel), 400 km a day included: ${cars}.
Bikes: ${bikes}.

## XTSY Voyage™ tour packages
Signature packages (fixed itineraries):
${signature}
Other tours on the site:
${tours}
Trip planner page: /tours/plan-trip-with-ai. All tours: /tours

## Hostel booking FAQs
${faqs}
`;
}

let cached: string | null = null;
export const siteKnowledge = () => (cached ??= build());
