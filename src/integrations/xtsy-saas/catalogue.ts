/**
 * Seed catalogue for the current locations. Values are read from the existing
 * owner-controlled sources so prices, hours and contact never drift.
 * Launching a new property or outlet = adding one record here (or later, from the PMS/POS API).
 */
import { ROOM_TYPES } from '@/config/roomTypes';
import { CAMP, CAMP_PLANS, CAMP_TENTS, CAMP_UNIT_ID } from '@/data/shnonpedengCamp';
import { PROPERTY_ADDRESS, PROPERTY_CHECK_IN, PROPERTY_CHECK_OUT } from '@/data/brandFacts';
import { BISTRO_BREAKFAST, BISTRO_EVENING, BISTRO_LAST_ORDER } from '@/data/tabBistroHours';
import type { GeoLocation, PmsProperty, PosOutlet } from './types';

export const DESK_WHATSAPP = '+918837317070';

const NEW_SHILLONG: GeoLocation = {
  continent: 'asia',
  countryCode: 'IN',
  countrySlug: 'india',
  region: 'Meghalaya',
  citySlug: 'shillong',
  city: 'Shillong',
  address: PROPERTY_ADDRESS,
};

const base = {
  status: 'active' as const,
  location: NEW_SHILLONG,
  currency: 'INR',
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  tax: { type: 'GST' as const, inclusive: false },
  deskWhatsapp: DESK_WHATSAPP,
  checkIn: PROPERTY_CHECK_IN,
  checkOut: PROPERTY_CHECK_OUT,
  franchise: { franchiseId: 'xtsy-company', ownership: 'company' as const },
};

const unitsFor = (propertyType: string) =>
  Object.values(ROOM_TYPES).filter((r) => r.propertyType === propertyType && r.isBookable).map((r) => r.id);

export const CAMP_PROPERTY_ID = 'XTSY-SHN-CAMP';

export const PMS_PROPERTIES: PmsProperty[] = [
  {
    ...base,
    propertyId: 'XTSY-SHL-HOSTEL',
    slug: 'travellers-hostel',
    name: 'XTSY Travellers Hostel',
    brand: 'xtsy-hostel',
    path: '/stays/best-hostel-in-shillong',
    // One property (owner, 20 Nov 2026): the hostel's rooms and Experience by XTSY on the same site.
    unitTypeIds: [...unitsFor('Experience by XTSY'), ...unitsFor('XTSY Travellers Hostel')],
  },
  {
    ...base,
    propertyId: CAMP_PROPERTY_ID,
    slug: 'shnonpedeng-riverside-camping',
    name: CAMP.name,
    brand: 'xtsy-partner-camp',
    path: '/stays/campsite-dawki',
    location: { ...NEW_SHILLONG, citySlug: 'shnonpedeng', city: 'Shnonpedeng', address: CAMP.where },
    tax: { type: 'GST', inclusive: false },
    franchise: { franchiseId: 'shnonpedeng-camp', ownership: 'franchise' },
    unitTypeIds: [CAMP_UNIT_ID],
  },
];

/** Experience by XTSY used to be its own console property; old blocks saved under it belong to the hostel. */
const LEGACY_PROPERTY: Record<string, string> = { 'XTSY-SHL-SUITE': 'XTSY-SHL-HOSTEL' };
export const canonicalPropertyId = (id: string) => LEGACY_PROPERTY[id] ?? id;

/** Name, nightly rate (₹, before GST) and units for any room type in the console, hostel or camp. */
export function unitInfo(id: string): { name: string; rate: number; totalUnits: number } | undefined {
  if (id === CAMP_UNIT_ID) return { name: 'Riverside tent (sleeps 2; bed spaces share a tent)', rate: CAMP_PLANS.tent.price, totalUnits: CAMP_TENTS };
  const r = ROOM_TYPES[id];
  return r ? { name: r.name, rate: r.basePrice, totalUnits: r.totalUnits } : undefined;
}

export const POS_OUTLETS: PosOutlet[] = [
  {
    outletId: 'TAB-SHL-01',
    brandSlug: 'tab-bistro',
    outletSlug: 'shillong-new-township',
    name: 'TAB Bistro by XTSY',
    status: 'active',
    path: '/tab-bistro',
    location: NEW_SHILLONG,
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    tax: { type: 'GST', inclusive: false },
    deskWhatsapp: DESK_WHATSAPP,
    serviceWindows: {
      breakfast: { opens: BISTRO_BREAKFAST.opens, closes: BISTRO_BREAKFAST.closes },
      dinner: { opens: BISTRO_EVENING.opens, closes: BISTRO_EVENING.closes, lastOrder: BISTRO_LAST_ORDER.time },
    },
    franchise: { franchiseId: 'xtsy-company', ownership: 'company' },
  },
];

export const findProperty = (id: string) => PMS_PROPERTIES.find((p) => p.propertyId === canonicalPropertyId(id));
export const findOutlet = (id: string) => POS_OUTLETS.find((o) => o.outletId === id);
