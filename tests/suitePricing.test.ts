import { describe, it, expect } from 'vitest';
import { PANORAMA_STAY_ONLY, PANORAMA_BREAKFAST_PER_PERSON } from '@/data/panoramaPricing';
import { readFileSync } from 'node:fs';

describe('Experience by XTSY pricing (owner, 16 and 20 Nov 2026)', () => {
  it('stay is ₹4,999 per night without breakfast', () => expect(PANORAMA_STAY_ONLY).toBe(4999));
  it('strike-out price is ₹9,999', () => expect(readFileSync('src/data/roomInventory.ts','utf8')).toMatch(/'xtsy-270': 9999/));
  it('breakfast is ₹280 per person, ₹560 for two', () => expect(PANORAMA_BREAKFAST_PER_PERSON * 2).toBe(560));
});

import { panoramaBreakfastTotal, quoteStay } from '@/data/panoramaPricing';
describe('suite breakfast add-on', () => {
  it('two guests, one night = ₹560', () => expect(panoramaBreakfastTotal(2, 1)).toBe(560));
  it('one guest, one night = ₹280', () => expect(panoramaBreakfastTotal(1, 1)).toBe(280));
  it('adds 5% GST to the stay and to breakfast', () => expect(quoteStay([{ nightlyRate: 4999, quantity: 1 }], 1, false, 560).total).toBe(4999 + 250 + 560 + 28));
  it('breakfast GST for two for one morning is ₹28', () => expect(quoteStay([], 1, false, 560).breakfastGst).toBe(28));
});
