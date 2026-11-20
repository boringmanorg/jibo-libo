/**
 * Shnonpedeng riverside camping: an XTSY franchise accommodation partner, booked through the XTSY desk.
 * The partner runs the camp and its meals; TAB Bistro and XTSY Travellers Hostel do not.
 * Owner-set rates (20 Nov 2026), in rupees. Browser-safe: used by /book, /book/campsite and
 * /stays/campsite-dawki so every page shows the same figures.
 */
import { DAWKI_CAMPING_IMAGES } from './properties';

export const CAMP = {
  place: 'Shnonpedeng',
  name: 'Shnonpedeng Riverside Camping',
  partnerLine: 'An XTSY franchise accommodation partner',
  where: 'By the Umngot river, Shnonpedeng, Meghalaya',
  /** Meals at the camp are prepared by the partner, not by TAB Bistro or XTSY Travellers Hostel. */
  mealsNote: 'Meals at the camp are prepared by the partner, not by TAB Bistro or XTSY Travellers Hostel. Add them with your booking.',
} as const;

export const CAMP_PLANS = {
  tent: { id: 'tent', title: 'Full tent for two', price: 1400, unit: 'a tent a night', line: 'A whole two-person tent for you and one more guest. Camping and bonfire.', guestsPer: 2 },
  bed: { id: 'bed', title: 'One bed space', price: 750, unit: 'a person a night', line: 'One bed space in a shared two-person tent, for a solo traveller.', guestsPer: 1 },
} as const;

export const CAMP_MEALS = {
  breakfast: { id: 'breakfast', title: 'Breakfast', price: 150, unit: 'a person a morning' },
  dinnerVeg: { id: 'dinnerVeg', title: 'Dinner, veg', price: 200, unit: 'a person a night' },
  dinnerNonVeg: { id: 'dinnerNonVeg', title: 'Dinner, non-veg', price: 250, unit: 'a person a night' },
} as const;

export type CampMealId = keyof typeof CAMP_MEALS;

export const CAMP_FROM = CAMP_PLANS.bed.price;

export const CAMP_PHOTOS = DAWKI_CAMPING_IMAGES.map((src) => ({ src, alt: 'Riverside tents on the Umngot river' }));

export type CampRequest = {
  nights: number;
  tents: number;
  beds: number;
  /** Guests taking each meal; breakfast is every morning, dinner every night. */
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
  for (const m of Object.keys(CAMP_MEALS) as CampMealId[]) if (r.meals[m] < 0 || r.meals[m] > guests) return 'Meals cannot be for more guests than are staying.';
  if (r.meals.dinnerVeg + r.meals.dinnerNonVeg > guests) return 'Veg and non-veg dinners together cannot be more than the guests staying.';
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
    if (people > 0) lines.push({ label: `${m.title} × ${people} guest${people === 1 ? '' : 's'} × ${n} ${m.id === 'breakfast' ? 'morning' : 'night'}${n === 1 ? '' : 's'}`, amount: people * m.price * n });
  }
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}
