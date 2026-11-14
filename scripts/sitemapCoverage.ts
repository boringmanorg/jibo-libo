import { isIndexableSEOSlug } from '../src/data/seoIndexPolicy';
import type { CoveragePage } from '../src/data/seoServiceCoverage';

/** Historical recovery lists must respect today's indexing policy, not override it. */
export function checkSitemapCoverage(
  recoverySlugs: readonly string[],
  includedSlugs: ReadonlySet<string>,
  pages: readonly CoveragePage[],
) {
  const pagesBySlug = new Map(pages.map((page) => [page.slug, page]));
  const required: string[] = [];
  const excluded: string[] = [];
  for (const slug of new Set(recoverySlugs)) {
    if (isIndexableSEOSlug(slug, pagesBySlug.get(slug))) required.push(slug);
    else excluded.push(slug);
  }
  return { required, excluded, missing: required.filter((slug) => !includedSlugs.has(slug)) };
}