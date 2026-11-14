import { describe, expect, it } from 'vitest';
import { serviceCoverageReason, excludedFoodListing } from '../src/data/seoServiceCoverage';
import { isIndexableSEOSlug } from '../src/data/seoIndexPolicy';
import { ALL_SEO_PAGES } from '../src/data/seoPages';
import { guideDirectory } from '../src/lib/seo/programmaticSeo';
import { programmaticPayload } from '../src/lib/seo/guidePageData';

describe('owner-defined SEO service coverage', () => {
  it('limits group tours to Meghalaya', () => {
    expect(serviceCoverageReason({ slug: 'group-tour-tawang', category: 'group-tours' })).not.toBeNull();
    expect(serviceCoverageReason({ slug: 'group-tour-dawki', category: 'group-tours' })).toBeNull();
  });
  it('limits honeymoons to Meghalaya', () => {
    expect(isIndexableSEOSlug('honeymoon-package-guwahati')).toBe(false);
    expect(isIndexableSEOSlug('honeymoon-package-meghalaya')).toBe(true);
  });
  it('keeps local Shillong hostel searches but excludes distant hostel coverage', () => {
    expect(isIndexableSEOSlug('best-hostel-in-guwahati')).toBe(false);
    expect(isIndexableSEOSlug('hostels-in-meghalaya')).toBe(false);
    expect(isIndexableSEOSlug('best-hostel-in-shillong')).toBe(true);
  });
  it('limits dining to New Shillong and local searches, not another operating neighbourhood', () => {
    expect(serviceCoverageReason({ slug: 'restaurants-in-new-shillong-township', category: 'restaurants' })).toBeNull();
    expect(serviceCoverageReason({ slug: 'restaurants-in-laitumkhrah', category: 'restaurants' })).not.toBeNull();
  });
  it('removes Khasi/traditional-food listings before page metadata loading', () => {
    expect(excludedFoodListing('traditional-food-meghalaya')).toBe(true);
    expect(programmaticPayload('khasi-food-guide')).toEqual({ status: 'redirect', to: '/tab-bistro' });
  });
  it('keeps general India and international tours and expeditions unrestricted', () => {
    for (const slug of ['kerala-tour-package', 'bhutan-tour-package', 'tawang-expedition']) {
      expect(serviceCoverageReason({ slug, category: 'tours' })).toBeNull();
    }
  });
  it('limits car and bike rentals to Assam and Meghalaya', () => {
    expect(isIndexableSEOSlug('vehicle-rental-northeast')).toBe(false);
    expect(isIndexableSEOSlug('car-rental-guwahati')).toBe(true);
    expect(isIndexableSEOSlug('bike-rental-shillong')).toBe(true);
  });
  it('removes out-of-scope guides from public discovery without deleting their addresses', () => {
    const listed = new Set(guideDirectory().flatMap(group => group.pages.map(page => page.slug)));
    const excluded = ALL_SEO_PAGES.filter(page => serviceCoverageReason(page));
    expect(excluded.length).toBeGreaterThan(50);
    expect(excluded.filter(page => listed.has(page.slug)).map(page => page.slug)).toEqual([]);
    expect(programmaticPayload('honeymoon-package-tawang').status).toBe('ok');
    const payload = programmaticPayload('honeymoon-package-tawang');
    if (payload.status === 'ok') expect(payload.head.noIndex).toBe(true);
  });
});