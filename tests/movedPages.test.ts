import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { MOVED_PAGES } from '../src/data/movedPages';

const sitemapText = fs.readdirSync('public').filter((f) => /^sitemap.*\.xml$/.test(f)).map((f) => fs.readFileSync(`public/${f}`, 'utf8')).join('\n');

describe('owner-approved page moves', () => {
  it('best hostel page lives under /stays', () => {
    expect(MOVED_PAGES['/best-hostel-in-shillong']).toBe('/stays/best-hostel-in-shillong');
  });
  it('restaurant page merges into /tab-bistro', () => {
    expect(MOVED_PAGES['/restaurant-in-shillong']).toBe('/tab-bistro');
  });
  it('no old address is listed in any sitemap', () => {
    for (const old of Object.keys(MOVED_PAGES)) expect(sitemapText).not.toContain(`<loc>https://xtsy.one${old}</loc>`);
  });
  it('every new address is listed in a sitemap', () => {
    for (const next of ['/stays/best-hostel-in-shillong', '/tours/meghalaya-tour-packages', '/guides/meghalaya-waterfalls', '/about/faq', '/tab-bistro/catering']) expect(sitemapText).toContain(`<loc>https://xtsy.one${next}</loc>`);
  });
});

import { legacyRedirectTarget } from '../src/data/legacyRedirects';
describe('legacy forwarding', () => {
  it('old glass suite address forwards to the suite page', () => {
    expect(legacyRedirectTarget('/xtsy-270')).toBe('/stays/experience-by-xtsy');
  });
  it('trailing slash forwards too', () => {
    expect(legacyRedirectTarget('/meghalaya-tour-packages/')).toBe('/tours/meghalaya-tour-packages');
  });
});

import { guidePath, resolveForwardTarget } from '../src/lib/guidePath';
describe('guide folder', () => {
  it('top-level guide slugs live under /guides', () => {
    expect(guidePath('meghalaya-travel-guide')).toBe('/guides/meghalaya-travel-guide');
  });
  it('real sections keep their own address', () => {
    expect(guidePath('tab-bistro')).toBe('/tab-bistro');
  });
  it('forwarding targets that moved resolve in one hop', () => {
    expect(resolveForwardTarget('/meghalaya-tour-packages')).toBe('/tours/meghalaya-tour-packages');
  });
});
