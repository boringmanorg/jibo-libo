import { describe, expect, it } from 'vitest';
import { guideDirectory } from '../src/lib/seo/programmaticSeo';
import { STATIC_PAGE_DIRECTORY } from '../src/data/staticPageDirectory';
import { programmaticPayload } from '../src/lib/seo/guidePageData';

describe('page directory resolution', () => {
  const pages = guideDirectory().flatMap((g) => g.pages);
  it('resolves every entry through a public static route or a usable guide', () => {
    const staticSlugs = new Set(STATIC_PAGE_DIRECTORY.map((p) => p.path.slice(1)));
    const unresolved = pages.filter((p) => !staticSlugs.has(p.slug) && programmaticPayload(p.slug).status !== 'ok');
    expect(unresolved.map((p) => p.slug)).toEqual([]);
  });
  it('gives a static title precedence when its URL also exists in the guide catalogue', () => {
    const collisions = pages.filter((p) => p.slug === 'best-hostel-in-shillong');
    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.label).toBe(STATIC_PAGE_DIRECTORY.find((p) => p.path === '/best-hostel-in-shillong')?.title);
  });
  it('does not list retired account or excluded pages as public content', () => {
    expect(pages.filter((p) => ['auth', 'profile', 'unsubscribe', 'install', 'gallery', 'book'].includes(p.slug))).toEqual([]);
  });
});