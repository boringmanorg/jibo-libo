import { describe, it, expect } from 'vitest';
import { PANORAMA_STAY_ONLY, PANORAMA_BREAKFAST_PER_PERSON } from '@/data/panoramaPricing';
import { ROOM_INVENTORY } from '@/data/roomInventory';

describe('Experience by XTSY pricing (owner, 16 Nov 2026)', () => {
  it('stay is ₹4,999 per night without breakfast', () => expect(PANORAMA_STAY_ONLY).toBe(4999));
  it('strike-out price is ₹9,999', () => expect((ROOM_INVENTORY as any)['xtsy-270'].originalApril).toBe(9999));
  it('breakfast is ₹280 per person, ₹560 for two', () => expect(PANORAMA_BREAKFAST_PER_PERSON * 2).toBe(560));
});
