/** Free, browser-safe answers from the same sources used by XTSY pages. */
import sitePages from '../../../public/search-pages.json';
import { buildIndex, quickSearch, type SitePage } from '@/lib/search/quickSearch';
import { BISTRO_HOURS_SENTENCE } from '@/data/tabBistroHours';
import { MENU_GST_NOTE } from '@/data/tabBistroMenu';
import { CAMP, CAMP_PLANS, CAMP_GST_NOTE } from '@/data/shnonpedengCamp';
import { BIKES, CARS } from '@/data/rentalFleet';

let index: ReturnType<typeof buildIndex> | undefined;
export function searchWebsite(query: string) {
  index ??= buildIndex([], sitePages as SitePage[]);
  return quickSearch(index, query.slice(0, 120), 3).map(({ entry }) => ({
    url: entry.url, title: entry.title, about: entry.description,
  }));
}

const inr = (value: number) => `₹${value.toLocaleString('en-IN')}`;

/** Canonical facts take priority over generated search descriptions. */
export function websiteFactAnswer(question: string): string | undefined {
  if (/tab bistro|\brestaurant\b|\bmenu\b|\blunch\b|\bdinner\b|\bbreakfast\b/i.test(question)) {
    return `**TAB Bistro at XTSY:** ${BISTRO_HOURS_SENTENCE} ${MENU_GST_NOTE} We deliberately do not serve local Khasi dishes; try local eateries for those. [Menu and table requests](/tab-bistro). The desk confirms requests on WhatsApp.`;
  }
  if (/\b(camping|campsite|tent)\b/i.test(question)) {
    return `**${CAMP.name}:** ${CAMP.partnerLine}, ${CAMP.where}. ${CAMP_PLANS.tent.title}: ${inr(CAMP_PLANS.tent.price)} ${CAMP_PLANS.tent.unit}; ${CAMP_PLANS.bed.title}: ${inr(CAMP_PLANS.bed.price)} ${CAMP_PLANS.bed.unit}. ${CAMP_GST_NOTE} ${CAMP.mealsNote} [Camping details](/stays/campsite-dawki). Check availability on [booking](/book?location=shnonpedeng); this is not a confirmed reservation.`;
  }
  if (/\brentals?\b|rent a (?:car|bike)|self.?drive/i.test(question)) {
    const fleet = /\bbikes?\b|motorcycle/i.test(question) ? BIKES : /\bcars?\b/i.test(question) ? CARS : [...CARS, ...BIKES];
    const named = fleet.filter((vehicle) => question.toLowerCase().includes(vehicle.name.toLowerCase()));
    const shown = named.length ? named : fleet;
    return `**XTSY Rentals:** self-drive cars and bikes for Assam and Meghalaya, from New Shillong.\n\n${shown.map((vehicle) => `• ${vehicle.name}: ${vehicle.price ? `${inr(vehicle.price)}/day` : 'price on request'}`).join('\n')}\n\n[Rental details and terms](/tours/xtsy-rentals). The desk confirms availability and the final quote on WhatsApp.`;
  }
  return undefined;
}

/** Discovery, not live data or model training; summaries update with the site index. */
export function websitePageAnswer(question: string): string | undefined {
  const terms = question.toLowerCase().match(/[a-z]{4,}/g)?.filter((word) =>
    !['what', 'where', 'when', 'does', 'have', 'tell', 'about', 'please', 'could', 'would', 'should', 'xtsy'].includes(word)) ?? [];
  const pages = searchWebsite(question).filter((page) => terms.some((term) => page.title.toLowerCase().includes(term)));
  if (!pages.length) return undefined;
  return `These XTSY pages cover your question:\n\n${pages.map((page) => `• [${page.title}](${page.url})`).join('\n')}\n\nUse the page for details; the desk confirms anything not covered. These are published guides, not live availability, road conditions or forecasts.`;
}