import { describe, it, expect } from 'vitest';
import { quickFactsFor } from '@/data/destinationQuickFacts';
import { getDestinationBySlug } from '@/data/meghalayaDestinations';

describe('destination quick facts', () => {
  it('never guesses an entry fee — unknown fees stay a placeholder', () => {
    const q = quickFactsFor(getDestinationBySlug('kynrem-falls')!)!;
    expect(q.rows.find(([k]) => k === 'Entry fee')![1]).toContain('{{ENTRY_FEE}}');
  });
  it('uses the 12 km distance stated in the Elephant Falls guide', () => {
    expect(quickFactsFor(getDestinationBySlug('elephant-falls')!)!.rows[1][1]).toContain('12 km');
  });
});
