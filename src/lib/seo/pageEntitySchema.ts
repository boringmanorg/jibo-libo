/**
 * Page-level entity schema for hand-written routes.
 *
 * Programmatic pages get their schema from programmaticSeo.ts. Static routes
 * built with buildRouteHead() had no equivalent, so 31 indexable pages shipped
 * carrying only WebSite + Organization — site-wide boilerplate that says
 * nothing about the page itself. An external audit read that as "article page
 * missing Article schema"; the real gap is that no entity described the page.
 *
 * Three builders, because one type does not fit all three shapes:
 *   articleSchema    — editorial guides and comparisons
 *   collectionSchema — hub pages listing other pages (CollectionPage+ItemList)
 *   infoPageSchema   — policy and reference pages, where Article would be a lie
 *
 * Deliberately NOT applied to pages that already declare a specific entity
 * (TouristTrip, TouristAttraction, Restaurant, ItemList). Those are correct,
 * and layering Article on top would contradict them.
 *
 * Dates follow the convention already used by programmaticSeo.ts rather than
 * inventing per-page values: a fixed datePublished and the shared
 * SEO_CONTENT_UPDATED as dateModified.
 */
import { SEO_CONTENT_UPDATED } from './programmaticSeo';

const SITE = 'https://xtsy.one';
const PUBLISHER = { '@id': `${SITE}/#organization` };
const AUTHOR = { '@type': 'Organization', name: 'XTSY Travel', url: SITE } as const;
const PUBLISHED = '2025-01-01';

const abs = (path: string) => `${SITE}${path === '/' ? '/' : path.replace(/\/$/, '')}`;

export function articleSchema(opts: {
  path: string;
  headline: string;
  description: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${abs(opts.path)}#article`,
    headline: opts.headline,
    description: opts.description,
    url: abs(opts.path),
    inLanguage: 'en-IN',
    author: AUTHOR,
    publisher: PUBLISHER,
    datePublished: PUBLISHED,
    dateModified: SEO_CONTENT_UPDATED,
    isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website` },
  };
}

export function collectionSchema(opts: {
  path: string;
  name: string;
  description: string;
  items?: { name: string; path: string }[];
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${abs(opts.path)}#collection`,
    name: opts.name,
    description: opts.description,
    url: abs(opts.path),
    inLanguage: 'en-IN',
    publisher: PUBLISHER,
    dateModified: SEO_CONTENT_UPDATED,
    ...(opts.items?.length
      ? {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: opts.items.length,
            itemListElement: opts.items.map((it, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: it.name,
              url: abs(it.path),
            })),
          },
        }
      : {}),
  };
}

/** Policy and reference pages: described, but never dressed up as editorial. */
export function infoPageSchema(opts: {
  path: string;
  name: string;
  description: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${abs(opts.path)}#webpage`,
    name: opts.name,
    description: opts.description,
    url: abs(opts.path),
    inLanguage: 'en-IN',
    publisher: PUBLISHER,
    dateModified: SEO_CONTENT_UPDATED,
    isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website` },
  };
}
