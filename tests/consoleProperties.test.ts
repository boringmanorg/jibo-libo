import { describe, it, expect } from 'vitest';
import { checkInUrl, propertyInventory, propertyMeals, propertyRates, enquiryProperty } from '@/admin/consoleProperties';

describe('property console and check-in routing', () => {
  it('keeps the hostel QR on the requested www domain with its own property', () => {
    expect(checkInUrl('XTSY-SHL-HOSTEL')).toBe('https://www.xtsy.one/check-in?property=XTSY-SHL-HOSTEL');
  });
  it('keeps the campsite QR separate on the same internal check-in page', () => {
    expect(checkInUrl('XTSY-SHN-CAMP')).toBe('https://www.xtsy.one/check-in?property=XTSY-SHN-CAMP');
  });
  it('does not represent campsite configured capacity as live availability', () => {
    expect(propertyInventory('XTSY-SHN-CAMP')).toEqual([{ id: 'tent', name: 'Two-person tents', total: 10, unit: 'tents', live: false }]);
  });
  it('keeps campsite overnight prices property-specific', () => {
    expect(propertyRates('XTSY-SHN-CAMP').map((r) => r.rate)).toEqual([1400, 700]);
  });
  it('keeps campsite meal prices separate from hostel breakfast selections', () => {
    expect(propertyMeals('XTSY-SHN-CAMP').map((m) => m.price)).toEqual([300, 120, 180]);
    expect(propertyMeals('XTSY-SHL-HOSTEL').some((m) => m.id === 'dinnerVeg')).toBe(false);
  });
  it('routes campsite and hostel enquiries to different property views', () => {
    expect(enquiryProperty('camp')).toBe('XTSY-SHN-CAMP');
    expect(enquiryProperty('stay')).toBe('XTSY-SHL-HOSTEL');
  });
});
