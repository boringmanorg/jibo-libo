import { describe, expect, it } from 'vitest';
import { findSEOPage, ALL_SEO_PAGES } from '../src/data/seoPages';
import { regionFor } from '../src/data/destinationGeography';
import { programmaticPayload } from '../src/lib/seo/guidePageData';

const MEGHALAYA_ONLY = /Mawlynnong|Living Root Bridge|Umngot|Mawsmai|Laitlum|Nongjrong|TAB Bistro|NH-6|Paltan Bazaar|Khasi, Garo/;

describe('destination authenticity', () => {
  it('places Champhai in Mizoram and Unakoti in Tripura', () => {
    expect(regionFor('champhai')?.state).toBe('Mizoram');
    expect(regionFor('unakoti')?.state).toBe('Tripura');
  });
  it('shows Tripura facts, not Meghalaya sights, on the Unakoti monsoon guide', () => {
    const page = findSEOPage('monsoon-in-unakoti')!;
    const text = JSON.stringify(page.sections);
    expect(text).toContain('Unakoti hillside rock-cut');
    expect(text).not.toMatch(MEGHALAYA_ONLY);
  });
  it('never puts Meghalaya-only sights on a guide about another state', () => {
    const meghalayaPlace = /meghalaya|shillong|cherrapunji|sohra|dawki|mawlynnong|mawsynram|jowai|tura|shnongpdeng|nongjrong|nongstoin|williamnagar|baghmara/;
    const leaks = ALL_SEO_PAGES.filter((p) => regionFor(p.slug) && !meghalayaPlace.test(p.slug))
      // A section that explicitly describes XTSY's own Shillong property may name TAB Bistro.
      .filter((p) => MEGHALAYA_ONLY.test(JSON.stringify(p.sections.filter((s) => !/^Where XTSY/.test(s.heading))) + JSON.stringify(p.faqs)))
      .map((p) => p.slug);
    expect(leaks).toEqual([]);
  });
  it('retires the Champhai honeymoon offer to the Mizoram guide', () => {
    expect(programmaticPayload('honeymoon-package-champhai')).toEqual({ status: 'redirect', to: '/destinations/mizoram' });
  });
});
