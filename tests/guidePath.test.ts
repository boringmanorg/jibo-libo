import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { guidePath } from '@/lib/guidePath';
import { LEGACY_REDIRECTS } from '@/data/legacyRedirects';

/**
 * guidePath() builds most internal links. When a page moves to /tours or /stays, links built
 * from its old slug must follow it there; a /guides/<slug> address for it does not exist.
 * On 18 Nov 2026 three such links 404'd on 77 pages and failed every production build at
 * prerender. Prerender no longer crawls links (vite.config.ts), so this test is the guard.
 */
const routeTree = readFileSync('src/routeTree.gen.ts', 'utf8');
const isRoute = (path: string) =>
  routeTree.includes(`fullPath: '${path}'`) || routeTree.includes(`fullPath: '${path}/'`); // index routes end in /

const singleSegment = Object.entries(LEGACY_REDIRECTS).filter(([from]) => /^\/[a-z0-9-]+$/.test(from));

describe('guidePath follows moved pages', () => {
  it.each(singleSegment)('%s links to %s', (from, to) => {
    expect(guidePath(from.slice(1))).toBe(to);
  });
});

describe('every moved page lands on a real route', () => {
  it.each(Object.entries(LEGACY_REDIRECTS))('%s -> %s', (_from, to) => {
    const path = to.split(/[?#]/)[0];
    expect(path === '/' || isRoute(path), `${to} is not a route`).toBe(true);
  });
});

describe('the three links that broke the build', () => {
  it.each([
    ['5-day-meghalaya-itinerary', '/tours/5-day-meghalaya-itinerary'],
    ['shillong-tour-package', '/tours/shillong-tour-package'],
    ['budget-hostels-shillong', '/stays/budget-hostels-shillong'],
  ])('%s -> %s', (slug, to) => expect(guidePath(slug)).toBe(to));
});
