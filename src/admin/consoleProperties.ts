import { CHECK_IN_PROPERTIES, type CheckInPropertyId } from '@/checkin/checkInModel';
import { CAMP_ID as REGISTRY_CAMP_ID, propertyCatalogue } from '@/properties';

export const CONSOLE_PROPERTIES = CHECK_IN_PROPERTIES;
export const CAMP_ID = REGISTRY_CAMP_ID;
export function checkInUrl(propertyId: CheckInPropertyId): string {
  return `https://www.xtsy.one/check-in?property=${propertyId}`;
}
export function propertyRates(propertyId: CheckInPropertyId) { return propertyCatalogue(propertyId).rates; }
export function propertyMeals(propertyId: CheckInPropertyId) { return propertyCatalogue(propertyId).meals; }
export function propertyInventory(propertyId: CheckInPropertyId) { return propertyCatalogue(propertyId).inventory; }
export function enquiryProperty(kind: string): CheckInPropertyId {
  return kind === 'camp' ? CAMP_ID : 'XTSY-SHL-HOSTEL';
}