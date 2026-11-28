import { describe, expect, it } from 'vitest';
import { smartRate } from '@/booking/smartPricing';

describe('manual night prices', () => {
  const base = 40000;
  it('uses the manual price when smart pricing is off', () => {
    expect(smartRate(base, { roomTypeId: 'x', enabled: false, minRupees: 0, maxRupees: 0, overrides: { '2026-12-01': 550 } }, 5, 8, '2026-12-01', '2026-11-28')).toBe(55000);
  });
  it('falls back to the standard rate on nights without a manual price', () => {
    expect(smartRate(base, { roomTypeId: 'x', enabled: false, minRupees: 0, maxRupees: 0, overrides: { '2026-12-01': 550 } }, 5, 8, '2026-12-02', '2026-11-28')).toBe(base);
  });
  it('ignores manual prices while smart pricing is on', () => {
    expect(smartRate(base, { roomTypeId: 'x', enabled: true, minRupees: 400, maxRupees: 500, overrides: { '2026-12-01': 900 } }, 8, 8, '2026-12-01', '2026-11-28')).toBe(40000);
  });
});
