import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getSearchIndex } from '@/data/searchIndex';
import { buildIndex, quickSearch, type SitePage } from '@/lib/search/quickSearch';

const pub = path.resolve('public');
const pages: SitePage[] = JSON.parse(fs.readFileSync(path.join(pub, 'search-pages.json'), 'utf8'));
const index = buildIndex(getSearchIndex(), pages);
const top = (q: string, n = 5) => quickSearch(index, q, n).map((h) => h.entry.url);

describe('instant site search', () => {
  it('covers every page in the sitemaps (run `npm run search:pages` when this fails)', () => {
    const have = new Set(pages.map((p) => p.u));
    const missing: string[] = [];
    for (const f of fs.readdirSync(pub).filter((f) => /^sitemap-.*\.xml$/.test(f) && f !== 'sitemap-images.xml')) {
      for (const m of fs.readFileSync(path.join(pub, f), 'utf8').matchAll(/<loc>https:\/\/xtsy\.one([^<]*)<\/loc>/g)) {
        if (!have.has(m[1] || '/')) missing.push(m[1] || '/');
      }
    }
    expect(missing).toEqual([]);
    expect(pages.length).toBeGreaterThan(500);
  });

  it('every curated result points at a real page', () => {
    const have = new Set([...pages.map((p) => p.u), '/book']);
    const broken = getSearchIndex().map((e) => e.url).filter((u) => !have.has(u.split(/[?#]/)[0]));
    expect([...new Set(broken)]).toEqual([]);
  });

  it('matches while typing: partial words, typos and everyday synonyms', () => {
    expect(top('cher').some((u) => /cherrapunji|sohra/.test(u))).toBe(true);
    expect(top('shnon')).toContain('/stays/campsite-dawki');
    expect(top('dawki camping', 3)).toContain('/stays/campsite-dawki');
    expect(top('meghalya tour').some((u) => u.includes('meghalaya'))).toBe(true);
    expect(top('self drive car').some((u) => u.includes('rentals'))).toBe(true);
    expect(top('glass')).toContain('/stays/experience-by-xtsy');
    expect(top('women dorm').length).toBeGreaterThan(0);
    expect(quickSearch(index, 'k')).toEqual([]);
  });

  it('is fast enough to run on every keystroke', () => {
    const queries = ['s', 'sh', 'shi', 'shil', 'shill', 'shillong', 'shillong h', 'shillong ho', 'shillong hostel', 'kerala backwaters', 'living root', 'tawang'];
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) for (const q of queries) quickSearch(index, q);
    const perQuery = (performance.now() - t0) / (10 * queries.length);
    expect(perQuery).toBeLessThan(15);
  });
});
