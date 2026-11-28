import { CHECK_IN_PROPERTIES, type CheckInPropertyId } from '@/checkin/checkInModel';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { CAMP_MEALS, CAMP_PLANS, CAMP_TENTS } from '@/data/shnonpedengCamp';
import { BREAKFAST_ITEMS } from '@/data/breakfastMenu';

export const CONSOLE_PROPERTIES = CHECK_IN_PROPERTIES;
export const CAMP_ID = 'XTSY-SHN-CAMP';
export function checkInUrl(propertyId: CheckInPropertyId): string {
  return `https://www.xtsy.one/check-in?property=${propertyId}`;
}
export function propertyRates(propertyId: CheckInPropertyId) {
  return propertyId === CAMP_ID
    ? Object.values(CAMP_PLANS).map((p) => ({ id: p.id, name: p.title, rate: p.price, unit: p.unit, capacity: p.guestsPer }))
    : BOOKING_ROOM_TYPES.map((r) => ({ id: r.id, name: r.name, rate: r.rate / 100, unit: `per ${r.soldAs} / night`, capacity: r.maxGuestsPerUnit }));
}
export function propertyMeals(propertyId: CheckInPropertyId) {
  return propertyId === CAMP_ID
    ? Object.values(CAMP_MEALS).map((m) => ({ id: m.id, name: m.title, price: m.price, unit: m.unit }))
    : BREAKFAST_ITEMS.map((m) => ({ id: m.id, name: m.name, price: m.price, unit: 'per item / morning' }));
}
export function propertyInventory(propertyId: CheckInPropertyId) {
  return propertyId === CAMP_ID
    ? [{ id: 'tent', name: 'Two-person tents', total: CAMP_TENTS, unit: 'tents', live: false }]
    : BOOKING_ROOM_TYPES.map((r) => ({ id: r.id, name: r.name, total: r.units, unit: `${r.soldAs}s`, live: true }));
}
export function enquiryProperty(kind: string): CheckInPropertyId {
  return kind === 'camp' ? CAMP_ID : 'XTSY-SHL-HOSTEL';
}