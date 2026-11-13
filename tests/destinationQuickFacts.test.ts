import { describe, it, expect } from 'vitest';
import { quickFactsFor, QUICK_FACT_SLUGS } from '@/data/destinationQuickFacts';
import { getDestinationBySlug } from '@/data/meghalayaDestinations';

const TOKEN = /\{\{[A-Z0-9_]+\}\}/;

describe('destination quick facts', () => {
  // The original rule was "never guess an entry fee", enforced by requiring an
  // {{ENTRY_FEE}} placeholder. That placeholder shipped and showed on the live
  // pages, so the rule is now enforced the other way: an unknown fact has no
  // row at all. Same guarantee, nothing leaked to the reader.
  it('never guesses an entry fee — an unknown fee gets no row', () => {
    const q = quickFactsFor(getDestinationBySlug('kynrem-falls')!)!;
    expect(q.rows.find(([k]) => k === 'Entry fee')).toBeUndefined();
  });

  it('renders no raw template token on any quick-facts destination', () => {
    for (const slug of QUICK_FACT_SLUGS) {
      const d = getDestinationBySlug(slug);
      if (!d) continue;
      const q = quickFactsFor(d)!;
      expect(q.inShort, `inShort for ${slug}`).not.toMatch(TOKEN);
      for (const [k, v] of q.rows) {
        expect(`${k} ${v}`, `row "${k}" for ${slug}`).not.toMatch(TOKEN);
      }
    }
  });

  it('never leaves an empty distance clause when the distance is unknown', () => {
    const q = quickFactsFor(getDestinationBySlug('kynrem-falls')!)!;
    expect(q.inShort).not.toContain('from Shillong');
    expect(q.rows.find(([k]) => k === 'Distance from Shillong')).toBeUndefined();
  });

  it('keeps the facts that are known — Elephant Falls distance survives', () => {
    const q = quickFactsFor(getDestinationBySlug('elephant-falls')!)!;
    const row = q.rows.find(([k]) => k === 'Distance from Shillong');
    expect(row?.[1]).toContain('12 km');
    expect(q.inShort).toContain('12 km from Shillong');
  });

  it('always keeps the rows that are always derivable', () => {
    const q = quickFactsFor(getDestinationBySlug('kynrem-falls')!)!;
    expect(q.rows.map(([k]) => k)).toEqual(['Location', 'Best season']);
  });
});
