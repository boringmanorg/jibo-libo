import { describe, expect, it } from 'vitest';
import { dailyDemand, decodeDemandDetails } from '@/admin/demandTrends';

describe('local search trends', () => {
  const rows = [
    { query: 'hostel in shillong', date: '2026-11-25', impressions: 120, clicks: 2 },
    { query: 'new shillong stay', date: '2026-11-25', impressions: 30, clicks: 0 },
    { query: 'camping shnonpedeng', date: '2026-11-25', impressions: 70, clicks: 1 },
    { query: 'phe phe falls jowai', date: '2026-11-25', impressions: 9000, clicks: 100 },
    { query: 'hostel shillong', date: '2026-10-01', impressions: 8000, clicks: 200 },
  ];
  it('aggregates Shillong appearances including searches without clicks', () => {
    const daily = dailyDemand(rows, 'XTSY-SHL-HOSTEL', '2026-11-26');
    expect(daily.find((d) => d.date === '2026-11-25')).toEqual({ date: '2026-11-25', impressions: 150, clicks: 2 });
    expect(daily.reduce((s, d) => s + d.impressions, 0)).toBe(150);
  });
  it('keeps Shnonpedeng separate from Shillong and unrelated places', () => {
    const daily = dailyDemand(rows, 'XTSY-SHN-CAMP', '2026-11-26');
    expect(daily.find((d) => d.date === '2026-11-25')?.impressions).toBe(70);
    expect(daily.reduce((s, d) => s + d.impressions, 0)).toBe(70);
  });
  it('fills the exact 35-day comparison window without including older rows', () => {
    const daily = dailyDemand(rows, 'XTSY-SHL-HOSTEL', '2026-11-26');
    expect(daily).toHaveLength(35);
    expect(daily[0]?.date).toBe('2026-10-23');
    expect(daily[34]).toEqual({ date: '2026-11-26', impressions: 0, clicks: 0 });
  });
  it('does not invent daily history for older query-only snapshots', () => {
    const queries = [{ query: 'shillong stay', impressions: 12, clicks: 0 }];
    expect(decodeDemandDetails(queries)).toEqual({ queries, daily: [] });
    const daily = dailyDemand(rows, 'XTSY-SHL-HOSTEL', '2026-11-26');
    expect(decodeDemandDetails({ queries, daily })).toEqual({ queries, daily });
  });
});