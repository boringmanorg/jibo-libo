import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAMP_MEALS, CAMP_PLANS, campProblem, campQuote } from '@/data/shnonpedengCamp';
import { BREAKFAST_ITEMS, breakfastItem } from '@/data/breakfastMenu';

const none = { breakfast: 0, dinnerVeg: 0, dinnerNonVeg: 0 };

describe('Shnonpedeng partner camp (owner, 20 Nov 2026)', () => {
  it('has the owner rates', () => {
    expect([CAMP_PLANS.tent.price, CAMP_PLANS.bed.price]).toEqual([1400, 750]);
    expect([CAMP_MEALS.breakfast.price, CAMP_MEALS.dinnerVeg.price, CAMP_MEALS.dinnerNonVeg.price]).toEqual([150, 200, 250]);
  });
  it('quotes tents, bed spaces and meals per night', () => {
    // 1 tent + 1 bed space = 3 guests, 2 nights; breakfast for 3, veg dinner 1, non-veg 2.
    const q = campQuote({ nights: 2, tents: 1, beds: 1, meals: { breakfast: 3, dinnerVeg: 1, dinnerNonVeg: 2 } });
    expect(q.total).toBe(2 * 1400 + 2 * 750 + 3 * 150 * 2 + 200 * 2 + 2 * 250 * 2);
  });
  it('refuses meals for more guests than are staying', () => {
    expect(campProblem({ nights: 1, tents: 1, beds: 0, meals: { ...none, breakfast: 3 } })).toMatch(/more guests/);
    expect(campProblem({ nights: 1, tents: 1, beds: 0, meals: { ...none, dinnerVeg: 1, dinnerNonVeg: 2 } })).toMatch(/Veg and non-veg/);
    expect(campProblem({ nights: 1, tents: 0, beds: 0, meals: none })).toMatch(/tent or a bed/);
    expect(campProblem({ nights: 1, tents: 1, beds: 0, meals: none })).toBeNull();
  });
  it('says the camp and its meals are not run by TAB Bistro or the hostel', () => {
    expect(readFileSync('src/data/shnonpedengCamp.ts', 'utf8')).toMatch(/not by TAB Bistro or XTSY Travellers Hostel/);
  });
  it('no longer shows the old Dawki campsite prices on its pages', () => {
    for (const f of ['src/pages/v2/CampsiteV2.tsx', 'src/components/v2/home/HomeSections.tsx', 'src/pages/CampsiteBookingFlow.tsx', 'src/components/booking/engine/BookExtras.tsx']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/₹800|₹1,000|inr\(800\)|inr\(1000\)/);
    }
  });
});

describe('TAB Bistro breakfast menu for stays', () => {
  it('lists breakfast dishes and beverages from the printed menu', () => {
    expect(breakfastItem('masala-dosa')?.price).toBe(180);
    expect(breakfastItem('milk-chai')?.price).toBe(60);
    expect(BREAKFAST_ITEMS.some((i) => i.group === 'Beverages')).toBe(true);
    expect(BREAKFAST_ITEMS.every((i) => Number.isInteger(i.price) && i.price > 0)).toBe(true);
    expect(new Set(BREAKFAST_ITEMS.map((i) => i.id)).size).toBe(BREAKFAST_ITEMS.length);
  });
});

describe('Shnonpedeng photos and GST (owner, 20 Nov 2026)', () => {
  it('uses the partner photos, all present on disk', async () => {
    const { CAMP_PHOTOS } = await import('@/data/shnonpedengCamp');
    const { existsSync } = await import('node:fs');
    expect(CAMP_PHOTOS).toHaveLength(6);
    for (const p of CAMP_PHOTOS) expect(existsSync(`public${p.src}`)).toBe(true);
    expect(CAMP_PHOTOS.some((p) => /Dawki Campsite/.test(p.src))).toBe(false);
  });
  it('adds no GST for now and says prices exclude GST', async () => {
    const { CAMP_GST_PERCENT, CAMP_GST_NOTE } = await import('@/data/shnonpedengCamp');
    expect(CAMP_GST_PERCENT).toBe(0);
    expect(CAMP_GST_NOTE).toMatch(/exclude GST/);
    expect(campQuote({ nights: 1, tents: 1, beds: 0, meals: none }).total).toBe(1400);
  });
});
