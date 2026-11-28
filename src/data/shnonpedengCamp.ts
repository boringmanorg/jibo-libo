/**
 * Shnonpedeng riverside camping: an XTSY franchise accommodation partner, booked through the XTSY desk.
 * The partner runs the camp and its meals; TAB Bistro and XTSY Travellers Hostel do not.
 * Owner-set rates (28 Nov 2026), in rupees. WhatsApp enquiry only: no live availability is shown. Browser-safe: used by /book, /book/campsite and
 * /stays/campsite-dawki so every page shows the same figures.
 */

export const CAMP = {
  place: 'Shnonpedeng',
  name: 'Shnonpedeng Riverside Camping by XTSY',
  partnerLine: 'An XTSY franchise accommodation partner',
  where: 'By the Umngot river, Shnonpedeng, Meghalaya',
  /** Meals at the camp are prepared by the partner, not by TAB Bistro or XTSY Travellers Hostel. */
  mealsNote: 'Meals at the camp are prepared by the partner, not by TAB Bistro or XTSY Travellers Hostel. Add them with your booking.',
} as const;

export const CAMP_PLANS = {
  tent: { id: 'tent', title: 'Full tent for two', price: 1400, unit: 'a tent a night', line: 'A whole two-person tent for you and one more guest. Camping and bonfire.', guestsPer: 2 },
  bed: { id: 'bed', title: 'One bed space', price: 700, unit: 'a person a night', line: 'One bed space in a shared two-person tent, for a solo traveller.', guestsPer: 1 },
} as const;

export const CAMP_MEALS = {
  combo: { id: 'combo', title: 'Breakfast & Dinner combo', price: 300, unit: 'a person a day' },
  breakfast: { id: 'breakfast', title: 'Only Breakfast', price: 120, unit: 'a person a morning' },
  dinnerVeg: { id: 'dinnerVeg', title: 'Only Dinner (Veg)', price: 180, unit: 'a person a night' },
} as const;

export type CampMealId = keyof typeof CAMP_MEALS;

export const CAMP_FROM = CAMP_PLANS.bed.price;

/** Channel-mapping capacity only (owner, 20 Nov 2026); guest pages never show camp availability. */
export const CAMP_TENTS = 10;
/** Room-type id the console uses for the camp's tents. */
export const CAMP_UNIT_ID = 'shnonpedeng-tent';

/** Tents a request uses: one per full tent, one per two bed spaces. */
export const tentsUsed = (r: { tents: number; beds: number }) => r.tents + Math.ceil(r.beds / 2);

/** Partner's own photos (owner, 20 Nov 2026), WebP in public/img/o. Order: hero first. */
export const CAMP_PHOTOS: { src: string; alt: string }[] = [
  { n: 1, alt: 'Tents on the sandy bank of the Umngot at Shnonpedeng, with kayaks and the suspension bridge' },
  { n: 3, alt: 'Grey dome tents on the riverbank at Shnonpedeng under forested hills' },
  { n: 2, alt: 'Tents by the Umngot at sunset, Shnonpedeng' },
  { n: 6, alt: 'The Shnonpedeng camp on the Umngot, seen from the bank' },
  { n: 4, alt: 'Tents beside the boats on the Umngot at Shnonpedeng' },
  { n: 5, alt: 'A row of tents on the Umngot riverbank, Shnonpedeng' },
].map(({ n, alt }) => ({ src: `/img/o/shnonpedeng-camp-${n}-1280.webp`, alt }));

/**
 * Listed camp prices exclude GST. No GST is collected for now (owner, 20 Nov 2026); when it starts,
 * set the rate here and every page and quote adds it on top.
 */
export const CAMP_GST_PERCENT = 0;
export const CAMP_GST_NOTE = CAMP_GST_PERCENT > 0 ? `Prices exclude GST; ${CAMP_GST_PERCENT}% GST is added.` : 'Prices exclude GST. No GST is charged for now.';

export type CampRequest = {
  nights: number;
  tents: number;
  beds: number;
  /** Guests taking each meal choice; each guest picks at most one choice. */
  meals: Record<CampMealId, number>;
};

export type CampQuoteLine = { label: string; amount: number };

/** Guests covered by the chosen tents and bed spaces. */
export const campGuests = (r: Pick<CampRequest, 'tents' | 'beds'>) => r.tents * CAMP_PLANS.tent.guestsPer + r.beds * CAMP_PLANS.bed.guestsPer;

/** Why the request can't be sent yet, or null. */
export function campProblem(r: CampRequest): string | null {
  const guests = campGuests(r);
  if (r.nights < 1) return 'Pick check-out at least one night after check-in.';
  if (guests < 1) return 'Add a tent or a bed space.';
  const ids = Object.keys(CAMP_MEALS) as CampMealId[];
  if (ids.some((m) => r.meals[m] < 0) || ids.reduce((s, m) => s + r.meals[m], 0) > guests) return 'Choose one meal option per guest at most.';
  return null;
}

/** Estimate in rupees. The desk confirms the final amount on WhatsApp. */
export function campQuote(r: CampRequest): { lines: CampQuoteLine[]; total: number } {
  const n = Math.max(r.nights, 0);
  const lines: CampQuoteLine[] = [];
  if (r.tents) lines.push({ label: `${r.tents} × ${CAMP_PLANS.tent.title} × ${n} night${n === 1 ? '' : 's'}`, amount: r.tents * CAMP_PLANS.tent.price * n });
  if (r.beds) lines.push({ label: `${r.beds} × ${CAMP_PLANS.bed.title} × ${n} night${n === 1 ? '' : 's'}`, amount: r.beds * CAMP_PLANS.bed.price * n });
  for (const m of Object.values(CAMP_MEALS)) {
    const people = r.meals[m.id];
    if (people > 0) lines.push({ label: `${m.title} × ${people} guest${people === 1 ? '' : 's'} × ${n} ${m.id === 'breakfast' ? 'morning' : m.id === 'combo' ? 'day' : 'night'}${n === 1 ? '' : 's'}`, amount: people * m.price * n });
  }
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const gst = Math.round((subtotal * CAMP_GST_PERCENT) / 100);
  if (gst > 0) lines.push({ label: `GST ${CAMP_GST_PERCENT}%`, amount: gst });
  return { lines, total: subtotal + gst };
}
