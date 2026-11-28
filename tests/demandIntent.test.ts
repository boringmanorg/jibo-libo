import { describe, expect, it } from 'vitest';
import { classifyQuery, demandMultiplier, readDemand, MIN_RECENT } from '@/booking/demandIntent';

describe('search intent → property', () => {
  it('Shillong and New Shillong stay searches count for the hostel', () => {
    expect(classifyQuery('dormitory in shillong')).toBe('XTSY-SHL-HOSTEL');
    expect(classifyQuery('hostel new shillong')).toBe('XTSY-SHL-HOSTEL');
    expect(classifyQuery('xtsy travellers hostel prices')).toBe('XTSY-SHL-HOSTEL');
  });
  it('Dawki and Shnongpdeng searches count for the campsite', () => {
    expect(classifyQuery('dawki bridge')).toBe('XTSY-SHN-CAMP');
    expect(classifyQuery('camping at shnongpdeng')).toBe('XTSY-SHN-CAMP');
    expect(classifyQuery('umngot river boating')).toBe('XTSY-SHN-CAMP');
  });
  it('Phe Phe falls, Jowai and unrelated places never influence either property', () => {
    expect(classifyQuery('phe phe falls jowai')).toBe('ignore');
    expect(classifyQuery('jowai to shillong distance')).toBe('ignore');
    expect(classifyQuery('mizoram itinerary 3 days')).toBe('ignore');
    expect(classifyQuery('100 guests')).toBe('ignore');
  });
});

describe('demand multiplier', () => {
  it('stays neutral when appearances are too few', () => expect(demandMultiplier(3, MIN_RECENT - 1)).toBe(1));
  it('rises with a search surge and dips when searches fall away', () => {
    expect(demandMultiplier(1.6, 500)).toBe(1.1);
    expect(demandMultiplier(1.25, 500)).toBe(1.05);
    expect(demandMultiplier(1, 500)).toBe(1);
    expect(demandMultiplier(0.5, 500)).toBe(0.95);
  });
  it('compares last 7 days with the weekly average before, per property', () => {
    const rows = [
      { query: 'dormitory in shillong', date: '2026-11-25', impressions: 300, clicks: 1 },
      { query: 'dormitory in shillong', date: '2026-11-10', impressions: 600, clicks: 3 },
      { query: 'phe phe falls', date: '2026-11-25', impressions: 9000, clicks: 0 },
    ];
    const [hostel, camp] = readDemand(rows, '2026-11-26');
    expect(hostel!.recentImpressions).toBe(300);
    expect(hostel!.baselineWeekly).toBe(150);
    expect(hostel!.multiplier).toBe(1.1);
    expect(camp!.recentImpressions).toBe(0);
    expect(camp!.multiplier).toBe(1);
  });
});
