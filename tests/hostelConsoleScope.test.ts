import { describe, it, expect } from 'vitest';
import { assertPropertyScope, canManageProperty, hostelConsolePath } from '@/admin/consoleScope';
import { UPCOMING_PROPERTIES, OWN_PROPERTIES } from '@/data/brandFacts';
import { CHECK_IN_PROPERTIES } from '@/checkin/checkInModel';

describe('hostel administrator scope', () => {
  it('allows hostel booking, inventory, invoice and check-in operations', () => {
    for (const path of ['/admin/bookings', '/admin/inventory', '/admin/invoices', '/admin/check-in', '/admin/inbox', '/admin/stays', '/admin/room-photos']) expect(hostelConsolePath(path)).toBe(true);
    expect(canManageProperty(false, 'XTSY-SHL-HOSTEL')).toBe(true);
  });
  it('rejects campsite property operations', () => {
    expect(() => assertPropertyScope(false, 'XTSY-SHN-CAMP')).toThrow(/Forbidden/);
    expect(canManageProperty(false, 'XTSY-SHN-CAMP')).toBe(false);
  });
  it('retains both properties for the super admin', () => {
    expect(canManageProperty(true, 'XTSY-SHN-CAMP')).toBe(true);
    expect(canManageProperty(true, 'XTSY-SHL-HOSTEL')).toBe(true);
  });
  it('keeps payment activation, shared connections and restaurant controls super-admin only', () => {
    for (const path of ['/admin/settings', '/admin/booking-engine', '/admin/restaurants']) expect(hostelConsolePath(path)).toBe(false);
  });
  it('keeps XTSY Bed & Breakfast, Sohra upcoming and out of active stays and check-in', () => {
    expect(UPCOMING_PROPERTIES).toEqual([{ name: 'XTSY Bed & Breakfast, Sohra', city: 'Sohra, Meghalaya', status: 'upcoming' }]);
    expect(OWN_PROPERTIES.some((p) => p.name === String(UPCOMING_PROPERTIES[0]?.name))).toBe(false);
    expect(CHECK_IN_PROPERTIES.some((p) => p.name === String(UPCOMING_PROPERTIES[0]?.name))).toBe(false);
  });
});
