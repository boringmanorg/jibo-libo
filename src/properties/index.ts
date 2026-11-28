/**
 * Property registry: one entry per property, each built only from that property's own file.
 * Console screens look a property up here instead of branching on ids, so editing one property's file cannot change another's.
 */
import { HOSTEL_ID, HOSTEL_ROOM_TYPES } from './xtsyHostel';
import { CAMP_MEALS, CAMP_PLANS, CAMP_TENTS } from '@/data/shnonpedengCamp';
import { BREAKFAST_ITEMS } from '@/data/breakfastMenu';

export const CAMP_ID = 'XTSY-SHN-CAMP';

export interface PropertyCatalogue {
  rates: { id: string; name: string; rate: number; unit: string; capacity: number }[];
  meals: { id: string; name: string; price: number; unit: string }[];
  inventory: { id: string; name: string; total: number; unit: string; live: boolean }[];
}

const hostel = (): PropertyCatalogue => ({
  rates: HOSTEL_ROOM_TYPES.map((r) => ({ id: r.id, name: r.name, rate: r.rate / 100, unit: `per ${r.soldAs} / night`, capacity: r.maxGuestsPerUnit })),
  meals: BREAKFAST_ITEMS.map((m) => ({ id: m.id, name: m.name, price: m.price, unit: 'per item / morning' })),
  inventory: HOSTEL_ROOM_TYPES.map((r) => ({ id: r.id, name: r.name, total: r.units, unit: `${r.soldAs}s`, live: true })),
});

const camp = (): PropertyCatalogue => ({
  rates: Object.values(CAMP_PLANS).map((p) => ({ id: p.id, name: p.title, rate: p.price, unit: p.unit, capacity: p.guestsPer })),
  meals: Object.values(CAMP_MEALS).map((m) => ({ id: m.id, name: m.title, price: m.price, unit: m.unit })),
  inventory: [{ id: 'tent', name: 'Two-person tents', total: CAMP_TENTS, unit: 'tents', live: false }],
});

const REGISTRY: Record<string, () => PropertyCatalogue> = { [HOSTEL_ID]: hostel, [CAMP_ID]: camp };
const EMPTY: PropertyCatalogue = { rates: [], meals: [], inventory: [] };

/** Unknown ids get an empty catalogue, never another property's rooms. */
export function propertyCatalogue(propertyId: string): PropertyCatalogue {
  const build = REGISTRY[propertyId];
  return build ? build() : EMPTY;
}
