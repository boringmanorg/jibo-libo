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
    for (const next of new Set(Object.values(MOVED_PAGES))) expect(sitemapText).toContain(`<loc>https://xtsy.one${next}</loc>`);
  });
});
