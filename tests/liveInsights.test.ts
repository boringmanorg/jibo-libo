import { describe, expect, it } from 'vitest';
import { summarizeLive, type LiveRow } from '@/admin/liveInsights';

const now = Date.parse('2026-11-28T12:00:00Z');
const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
const H = 'XTSY-SHL-HOSTEL', C = 'XTSY-SHN-CAMP';
const rows: LiveRow[] = [
  { session: 'a', propertyId: H, stage: 'view', at: at(2), reference: null },
  { session: 'b', propertyId: H, stage: 'view', at: at(5), reference: null },
  { session: 'b', propertyId: H, stage: 'rooms', at: at(4), reference: null },
  { session: 'b', propertyId: H, stage: 'details', at: at(3), reference: null },
  { session: 'c', propertyId: H, stage: 'rooms', at: at(60), reference: null },
  { session: 'd', propertyId: H, stage: 'details', at: at(50), reference: null },
  { session: 'd', propertyId: H, stage: 'contacted', at: at(49), reference: 'XTSY-AB123' },
  { session: 'e', propertyId: C, stage: 'view', at: at(1), reference: null },
];
describe('live insights', () => {
  const [h, c] = summarizeLive(rows, now, [H, C]);
  it('counts who is on each step right now', () => { expect(h!.now).toEqual({ viewing: 1, rooms: 0, details: 1 }); expect(c!.now.viewing).toBe(1); });
  it('counts a quiet visit that chose rooms but never contacted as dropped', () => { expect(h!.period.dropped).toBe(1); });
  it('counts contacted visits with their enquiry reference', () => { expect(h!.period.contacted).toBe(1); expect(h!.contactedRefs).toEqual(['XTSY-AB123']); });
  it('lists a property with no visits yet', () => { expect(summarizeLive([], now, [H])[0]!.period.visits).toBe(0); });
});
