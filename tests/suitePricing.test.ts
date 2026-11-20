import { describe, it, expect } from 'vitest';
import { PANORAMA_STAY_ONLY, quoteStay } from '@/data/panoramaPricing';
import { readFileSync } from 'node:fs';

describe('Experience by XTSY pricing (owner, 16 and 20 Nov 2026)', () => {
  it('stay is ₹4,999 per night without breakfast', () => expect(PANORAMA_STAY_ONLY).toBe(4999));
  it('strike-out price is ₹9,999', () => expect(readFileSync('src/data/roomInventory.ts','utf8')).toMatch(/'xtsy-270': 9999/));
  it('no longer quotes a fixed ₹280 breakfast (owner, 20 Nov 2026: breakfast is picked from the menu)', () => {
    for (const f of ['src/pages/v2/ExperienceByXtsy.tsx', 'src/components/WhatsAppBookingForm.tsx', 'src/components/booking/engine/StayEngine.tsx']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/280\s*(per person|\/person)/);
    }
  });
});

describe('suite quote with a breakfast amount', () => {
  it('adds 5% GST to the stay and to breakfast', () => expect(quoteStay([{ nightlyRate: 4999, quantity: 1 }], 1, false, 560).total).toBe(4999 + 250 + 560 + 28));
});
