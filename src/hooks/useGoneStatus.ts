import { GONE_SLUGS } from "@/data/seoGoneSlugs";

/**
 * 410 Gone strategy.
 * ------------------
 * A slug is permanently removed by adding it to GONE_SLUGS. Each one also has
 * an explicit route (src/routes/<slug>.tsx) so it renders a proper "removed"
 * page, and src/server.ts rewrites that response to a real HTTP 410 on the way
 * out — the router forces 200 on any matched route, so the status cannot be set
 * from a loader.
 *
 * This hook resolves the status a page should *present*. It is now a pure
 * lookup: it previously also queried a `seo_redirects` table so an admin could
 * retire a URL without a redeploy, but the site no longer has a database, so
 * that call resolved against the offline backend and could never return a row.
 */
export function useGoneStatus(pathname: string, initial: 404 | 410): 404 | 410 {
  if (initial === 410) return 410;
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const firstSegment = normalized.replace(/^\//, "").split("/")[0];
  return GONE_SLUGS.has(firstSegment) ? 410 : 404;
}
