import { describe, expect, it } from 'vitest';
import { smartRate } from '@/booking/smartPricing';

const rule = { roomTypeId: 'x', enabled: true, minRupees: 350, maxRupees: 600 };
const today = '2026-12-01', far = '2026-12-20';

describe('smart pricing', () => {
  it('keeps the base price when switched off', () => { expect(smartRate(40000, { ...rule, enabled: false }, 0, 8, far, today)).toBe(40000); });
  it('keeps the base price with no rule', () => { expect(smartRate(40000, undefined, 0, 8, far, today)).toBe(40000); });
  it('raises 25% when 90% or more is taken', () => { expect(smartRate(40000, rule, 0, 10, far, today)).toBe(50000); });
  it('raises 15% at 75% taken', () => { expect(smartRate(40000, rule, 2, 8, far, today)).toBe(46000); });
  it('drops 10% for an empty night two days out', () => { expect(smartRate(40000, rule, 8, 8, '2026-12-03', today)).toBe(36000); });
  it('never goes above the owner maximum', () => { expect(smartRate(60000, rule, 0, 8, far, today)).toBe(60000); });
  it('adds search demand on top, still inside the owner limits', () => { expect(smartRate(40000, { ...rule, demandMultiplier: 1.1 }, 8, 8, far, today)).toBe(44000); expect(smartRate(50000, { ...rule, demandMultiplier: 1.1 }, 0, 10, far, today)).toBe(60000); });
  it('never goes below the owner minimum', () => { expect(smartRate(38000, rule, 8, 8, today, today)).toBe(35000); });
});
