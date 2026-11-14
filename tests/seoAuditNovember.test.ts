import { describe, expect, it } from 'vitest';
import { schemaImage } from '../src/lib/seo/metadataText';
import { ALL_SEO_PAGES } from '../src/data/seoPages';
import { schemaFor } from '../src/lib/seo/programmaticSeo';

describe('November SEO audit: valid image URLs', () => {
  it('does not advertise placeholder media as a real attraction image', () => {
    expect(schemaImage('/placeholder.svg')).toBeUndefined();
    expect(schemaImage('')).toBeUndefined();
  });

  it('preserves HTTPS media origins and resolves local media once', () => {
    expect(schemaImage('https://images.pexels.com/photos/1/test.jpg')).toBe('https://images.pexels.com/photos/1/test.jpg');
    expect(schemaImage('/img/waterfall.webp')).toBe('https://xtsy.one/img/waterfall.webp');
  });

  it('publishes actual absolute images across the programmatic catalogue', () => {
    const urls: string[] = [];
    for (const page of ALL_SEO_PAGES) {
      for (const wrapper of schemaFor(page)) {
        for (const node of wrapper['@graph'] as Record<string, unknown>[]) {
          if (typeof node.image === 'string') urls.push(node.image);
        }
      }
    }
    expect(urls.length).toBeGreaterThan(100);
    expect(urls.every(url => /^https:\/\/(?!.*https:\/\/)/.test(url) && !url.includes('placeholder'))).toBe(true);
  });
});