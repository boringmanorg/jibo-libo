import { describe, it, expect } from 'vitest';
import { articleSchema, collectionSchema, infoPageSchema } from '@/lib/seo/pageEntitySchema';

describe('page entity schema', () => {
  const common = { path: '/meghalaya-festivals', description: 'desc' };

  it('builds a valid Article with author, publisher and dates', () => {
    const a = articleSchema({ ...common, headline: 'Meghalaya festivals' }) as Record<string, any>;
    expect(a['@type']).toBe('Article');
    expect(a.headline).toBe('Meghalaya festivals');
    expect(a.author).toMatchObject({ '@type': 'Organization' });
    expect(a.publisher).toHaveProperty('@id');
    expect(a.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.url).toBe('https://xtsy.one/meghalaya-festivals');
  });

  it('normalises the url and never double-slashes', () => {
    for (const p of ['/merch', '/merch/', '/']) {
      const url = (collectionSchema({ path: p, name: 'n', description: 'd' }) as any).url as string;
      expect(url.startsWith('https://xtsy.one')).toBe(true);
      expect(url.slice('https://'.length)).not.toContain('//');
    }
  });

  it('emits an ItemList only when a collection actually has items', () => {
    const empty = collectionSchema({ path: '/merch', name: 'n', description: 'd' }) as any;
    expect(empty.mainEntity).toBeUndefined();
    const full = collectionSchema({
      path: '/destinations', name: 'n', description: 'd',
      items: [{ name: 'Dawki', path: '/dawki' }, { name: 'Sohra', path: '/sohra' }],
    }) as any;
    expect(full.mainEntity['@type']).toBe('ItemList');
    expect(full.mainEntity.numberOfItems).toBe(2);
    expect(full.mainEntity.itemListElement[1].position).toBe(2);
  });

  // A privacy policy is not editorial. Calling it an Article would be a lie
  // told to a machine, which is the one audience that cannot discount it.
  it('keeps policy pages as WebPage, never Article', () => {
    const w = infoPageSchema({ path: '/privacy-policy', name: 'Privacy', description: 'd' }) as any;
    expect(w['@type']).toBe('WebPage');
    expect(JSON.stringify(w)).not.toContain('Article');
  });
});
