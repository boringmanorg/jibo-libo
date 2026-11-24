import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { routeHero } from '@/data/routeHeroes';
import { creditFor } from '@/data/photoCredits';
import { SITE_PHOTOS } from '@/data/sitePhotos';
import { BIKES, CARS } from '@/data/rentalFleet';
import { reviewedPhoto } from '@/data/tourPhotos';
import { getAllTours } from '@/data/travelData';

const pages: { u: string }[] = JSON.parse(fs.readFileSync('public/search-pages.json', 'utf8'));

describe('real, credited photos', () => {
  it('every page that gets a hero band has a credited photo', () => {
    const banded = pages.map((p) => [p.u, routeHero(p.u)] as const).filter(([, h]) => h);
    expect(banded.length).toBeGreaterThan(50);
    for (const [u, h] of banded) {
      expect(creditFor(h!.src), u).not.toBeNull();
      expect(h!.alt.length, u).toBeGreaterThan(3);
    }
    expect(routeHero('/')).toBeNull();
    expect(routeHero('/stays/experience-by-xtsy')).toBeNull();
  });

  it('every car and bike shows a credited photo of its model', () => {
    for (const v of [...CARS, ...BIKES]) {
      const p = SITE_PHOTOS[v.photo ?? ''];
      expect(p, v.name).toBeDefined();
      if (!p) throw new Error(`Missing photo for ${v.name}`);
      const first = p.srcs[0];
      expect(creditFor(first?.[1])?.by, v.name).toBeTruthy();
      for (const [, src] of p.srcs) {
        if (src.startsWith('/__l5e/assets-v1/')) {
          expect(p.avifSrcs?.length, v.name).toBe(p.srcs.length);
          continue;
        }
        expect(fs.existsSync(`public${src}`), src).toBe(true);
        expect(fs.existsSync(`public${src.replace(/\.webp$/, '.avif')}`), src).toBe(true);
      }
    }
  });

  it('every reviewed site photo carries a free licence and its source page', () => {
    for (const [k, p] of Object.entries(SITE_PHOTOS)) {
      expect(p.page, k).toMatch(/^https:\/\/(commons\.wikimedia\.org|www\.pexels\.com)\//);
      expect(p.license, k).toMatch(/^(CC0|CC BY(-SA)? \d\.\d|Public domain|Pexels licence)/);
    }
  });

  it('every tour card has a credited photo, and no file without a known source is used', () => {
    const missing = getAllTours().map((t) => `tour-${t.id}`).filter((k) => { const s = reviewedPhoto(k); return s && !creditFor(s); });
    expect(missing).toEqual([]);
    expect(fs.existsSync('src/assets/travel')).toBe(false);
    expect(fs.existsSync('src/assets/meghalaya')).toBe(false);
  });
});
