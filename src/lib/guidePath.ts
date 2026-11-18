/**
 * Guide pages live under /guides (owner approval, 18 Nov 2026). Slugs that already
 * contain a folder, or name a real top-level section, keep their own address.
 */
const TOP_LEVEL = new Set(['', 'about', 'guides', 'book', 'tours', 'stays', 'tab-bistro', 'destinations', 'expeditions', 'travel-guide', 'places-to-visit']);

export function guidePath(slug: string): string {
  const clean = slug.replace(/^\/+|\/+$/g, '');
  if (clean.includes('/') || TOP_LEVEL.has(clean)) return `/${clean}`;
  return `/guides/${clean}`;
}

import { legacyRedirectTarget } from '@/data/legacyRedirects';

/** Final address for a forwarding target: known old addresses first, then the guide folder. */
export function resolveForwardTarget(to: string): string {
  const path = to.startsWith('/') ? to : `/${to}`;
  return legacyRedirectTarget(path) ?? guidePath(path);
}
