import { describe, expect, it } from 'vitest';
import { resolveRange } from '@/admin/dateRange';
import { summarizeArrivals } from '@/admin/insights';
import { arrivalFromOpen, checkOutProblem, requiredDocumentKeys } from '@/checkin/checkInModel';

describe('console date ranges', () => {
  const today = '2026-11-28';
  it('yesterday is a single day before today', () => expect(resolveRange('yesterday', undefined, undefined, today)).toMatchObject({ from: '2026-11-27', to: '2026-11-27' }));
  it('last 7 days includes today', () => expect(resolveRange('7d', undefined, undefined, today)).toMatchObject({ from: '2026-11-22', to: today }));
  it('custom range swaps reversed dates', () => expect(resolveRange('custom', '2026-11-20', '2026-11-10', today)).toMatchObject({ from: '2026-11-10', to: '2026-11-20' }));
});

describe('arrival insights', () => {
  it('counts guests and guest-nights in range only', () => {
    const s = summarizeArrivals([
      { propertyId: 'XTSY-SHL-HOSTEL', checkInDate: '2026-11-27', checkOutDate: '2026-11-29', totalGuests: 2, referralSource: 'Instagram' },
      { propertyId: 'XTSY-SHL-HOSTEL', checkInDate: '2026-11-01', checkOutDate: '2026-11-02', totalGuests: 5 },
    ], { from: '2026-11-22', to: '2026-11-28' });
    expect(s).toMatchObject({ checkIns: 1, guests: 2, guestNights: 4 });
    expect(s.sources[0]).toEqual({ label: 'Instagram', count: 1 });
  });
});

describe('self check-in group documents', () => {
  it('needs a selfie and ID for every guest in the group', () => {
    expect(requiredDocumentKeys({ mainDocMode: 'separate', isInternational: false, guests: [{ docMode: 'single' }, { docMode: 'separate' }] }))
      .toEqual(['selfie', 'front', 'back', 'g2-single', 'g3-front', 'g3-back']);
  });
  it('international main guest also uploads a visa', () => {
    expect(requiredDocumentKeys({ mainDocMode: 'single', isInternational: true, guests: [] })).toEqual(['selfie', 'front', 'visa']);
  });
  it('check-out must be after arrival', () => {
    expect(checkOutProblem({ checkInDate: '2026-11-28', checkInTime: '19:00', checkOutDate: '2026-11-28', checkOutTime: '10:00' })).not.toBeNull();
    expect(checkOutProblem({ checkInDate: '2026-11-28', checkInTime: '19:00', checkOutDate: '2026-11-29', checkOutTime: '10:00' })).toBeNull();
  });
  it('arrival defaults to the moment the form opened', () => {
    expect(arrivalFromOpen(new Date(2026, 10, 28, 19, 5))).toEqual({ date: '2026-11-28', time: '19:05' });
  });
});
