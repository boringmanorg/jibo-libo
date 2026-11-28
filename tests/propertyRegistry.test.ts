import { describe, expect, it } from 'vitest';
import { propertyCatalogue, CAMP_ID } from '@/properties';
import { HOSTEL_ID } from '@/properties/xtsyHostel';

describe('property registry', () => {
  it('keeps each property to its own rooms', () => {
    const hostel = propertyCatalogue(HOSTEL_ID).rates.map((r) => r.id);
    const camp = propertyCatalogue(CAMP_ID).rates.map((r) => r.id);
    expect(hostel).toHaveLength(7);
    expect(camp).toEqual(['tent', 'bed']);
    expect(hostel.some((id) => camp.includes(id))).toBe(false);
  });
  it('gives an unknown property nothing rather than the hostel', () => {
    expect(propertyCatalogue('XTSY-NEW').rates).toEqual([]);
  });
});
