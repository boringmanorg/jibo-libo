import { describe, expect, it } from 'vitest';
import { checkSitemapCoverage } from '../scripts/sitemapCoverage';

describe('historical sitemap coverage', () => {
  for (const slug of ['hostels-in-meghalaya', 'khasi-food-guide', 'street-food-police-bazar', 'vehicle-rental-northeast']) {
    it(`does not require intentionally excluded ${slug}`, () => {
      const result = checkSitemapCoverage([slug], new Set(), []);
      expect(result.excluded).toEqual([slug]);
      expect(result.missing).toEqual([]);
    });
  }

  it('still flags a missing indexable Shillong hostel page', () => {
    expect(checkSitemapCoverage(['best-hostel-in-shillong'], new Set(), []).missing)
      .toEqual(['best-hostel-in-shillong']);
  });

  it('does not silently ignore unknown unrestricted recovery pages', () => {
    expect(checkSitemapCoverage(['new-meghalaya-guide'], new Set(), []).missing)
      .toEqual(['new-meghalaya-guide']);
  });

  it('accepts included indexable pages and deduplicates recovery lists', () => {
    const result = checkSitemapCoverage(['best-hostel-in-shillong', 'best-hostel-in-shillong'], new Set(['best-hostel-in-shillong']), []);
    expect(result.required).toEqual(['best-hostel-in-shillong']);
    expect(result.missing).toEqual([]);
  });

  it('uses registry category restrictions as well as slug restrictions', () => {
    const result = checkSitemapCoverage(['assam-student-trip'], new Set(), [{ slug: 'assam-student-trip', category: 'group-tours' }]);
    expect(result.excluded).toEqual(['assam-student-trip']);
    expect(result.missing).toEqual([]);
  });
});