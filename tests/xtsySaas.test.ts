import { describe, expect, it } from 'vitest';
import { PMS_PROPERTIES, POS_OUTLETS, findProperty, unitInfo } from '@/integrations/xtsy-saas/catalogue';
import { buildQrOrderUrl } from '@/integrations/xtsy-saas/types';
import { ROOM_TYPES } from '@/config/roomTypes';

describe('PMS/POS seed catalogue', () => {
  it('maps every bookable room to exactly one property', () => {
    const mapped = PMS_PROPERTIES.flatMap((p) => p.unitTypeIds).filter((id) => id in ROOM_TYPES).sort();
    const bookable = Object.values(ROOM_TYPES).filter((r) => r.isBookable).map((r) => r.id).sort();
    expect(mapped).toEqual(bookable);
  });
  it('lists two properties: the hostel (with Experience by XTSY) and the Shnonpedeng partner camp of 10 tents', () => {
    expect(PMS_PROPERTIES.map((p) => p.name)).toEqual(['XTSY Travellers Hostel', 'Shnonpedeng Riverside Camping by XTSY']);
    expect(PMS_PROPERTIES[0].unitTypeIds).toContain('xtsy-270');
    expect(unitInfo('shnonpedeng-tent')?.totalUnits).toBe(10);
    expect(findProperty('XTSY-SHL-SUITE')?.propertyId).toBe('XTSY-SHL-HOSTEL');
  });
  it('keeps the approved desk number, check-in 11:00 and check-out 10:00', () => {
    for (const p of PMS_PROPERTIES) {
      expect(p.deskWhatsapp).toBe('+918837317070');
      expect(p.checkIn).toBe('11:00');
      expect(p.checkOut).toBe('10:00');
    }
  });
  it('TAB Bistro has no regular lunch window and last order 22:30', () => {
    const tab = POS_OUTLETS[0];
    expect(tab.serviceWindows.lunch).toBeUndefined();
    expect(tab.serviceWindows.dinner?.lastOrder).toBe('22:30');
  });
  it('builds a table QR ordering link', () => {
    expect(buildQrOrderUrl('https://posbyxtsy.club', 'TAB-SHL-01', 'T4')).toBe('https://posbyxtsy.club/order/TAB-SHL-01?table=T4');
  });
});
