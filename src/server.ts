import { legacyRedirectTarget } from "@/data/legacyRedirects";
import { guidePath, resolveForwardTarget } from "@/lib/guidePath";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { GONE_SLUGS } from "./data/seoGoneSlugs";
import { renderErrorPage } from "./lib/error-page";
import { withPageCache, cacheKey } from "./lib/pageCache";
import { isAdminPath, isBookingPath, serverOnlySecurityHeaders, withAdminConnectSources, withBotCheckSources } from "./utils/productionSecurityHeaders";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Framing protection must be an HTTP header: browsers ignore frame-ancestors and X-Frame-Options
// in <meta> tags (the 22 Oct 2026 error sweep found both ignored, and logged, on every page).
const FRAME_HEADERS = serverOnlySecurityHeaders({ isDevelopment: false });
const ADMIN_FRAME_HEADERS = {
  ...FRAME_HEADERS,
  "Content-Security-Policy": withBotCheckSources(withAdminConnectSources(FRAME_HEADERS["Content-Security-Policy"])),
};
const BOOKING_FRAME_HEADERS = {
  ...FRAME_HEADERS,
  "Content-Security-Policy": withBotCheckSources(withAdminConnectSources(FRAME_HEADERS["Content-Security-Policy"])),
};
function withFrameProtection(request: Request, response: Response): Response {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) return response;
  let path = "";
  try {
    path = new URL(request.url).pathname;
  } catch {
    /* keep the guest policy */
  }
  const headers = isAdminPath(path) ? ADMIN_FRAME_HEADERS : isBookingPath(path) ? BOOKING_FRAME_HEADERS : FRAME_HEADERS;
  let out = response;
  try {
    for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  } catch {
    // Immutable headers (e.g. a cached or fetched Response): copy, then set.
    out = new Response(response.body, response);
    for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  }
  return out;
}

// Permanently removed URLs must answer a real HTTP 410.
//
// The router owns the SSR status (a matched route is 200, notFound() is 404),
// so a route loader cannot raise 410 by itself: setResponseStatus is overwritten
// and throwing a Response turns into a 500. The old approach -- a
// <meta name="prerender-status-code" content="410"> tag -- is a Prerender.io
// convention Googlebot does not read, and it depended on the Cloudflare edge
// worker translating it, which never runs on live traffic.
//
// So the gone routes render their page normally and the status is corrected
// here, on the way out. This sits outside withPageCache on purpose: a cached
// body is still served, but the status is re-applied on every request.
function withGoneStatus(request: Request, response: Response): Response {
  if (response.status !== 200) return response;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;

  let slug: string;
  try {
    slug = new URL(request.url).pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/")[0];
  } catch {
    return response;
  }
  if (!slug || !GONE_SLUGS.has(slug)) return response;

  return new Response(response.body, {
    status: 410,
    statusText: "Gone",
    headers: response.headers,
  });
}

/**
 * www -> apex, as a 301.
 *
 * This lives here because this is the worker that serves the site. A separate
 * edge worker used to carry this redirect, but it was bound to a single canary
 * route and a Custom Domain on this app outranked its route patterns, so it
 * never ran on real traffic; it has since been retired. www.xtsy.one reaches
 * THIS worker, so a redirect placed here actually executes.
 *
 * Runs before the page cache and before SSR: there is no point rendering, or
 * caching, a page we are about to redirect away from.
 *
 * Matches the www host exactly. Never fires on the apex, on localhost, or on a
 * preview hostname, so local development and previews are untouched.
 */
const CANONICAL_HOST = "xtsy.one";
const HSTS = "max-age=63072000; includeSubDomains; preload";

/** Old page addresses (src/data/legacyRedirects.ts) forward permanently in one hop, query kept. */
export function legacyRedirect(request: Request): Response | null {
  let url: URL;
  try { url = new URL(request.url); } catch { return null; }
  const target = legacyRedirectTarget(url.pathname);
  if (!target) return null;
  return new Response(null, {
    status: 301,
    headers: { location: target + url.search, "cache-control": "public, max-age=3600", "x-redirect-source": "legacy-page" },
  });
}

/** Old top-level guide addresses (e.g. /meghalaya-travel-guide) forward to /guides/<slug> in one hop. */
async function guideRedirect(request: Request): Promise<Response | null> {
  let url: URL;
  try { url = new URL(request.url); } catch { return null; }
  const m = /^\/([a-z0-9-]+)\/?$/.exec(url.pathname);
  if (!m || guidePath(m[1]) !== `/guides/${m[1]}`) return null;
  const { programmaticPayload } = await import("@/lib/seo/guidePageData");
  const data = programmaticPayload(m[1]);
  const target = data.status === "redirect" ? resolveForwardTarget(data.to) : data.status === "ok" ? `/guides/${m[1]}` : null;
  if (!target) return null;
  return new Response(null, {
    status: 301,
    headers: { location: target + url.search, "cache-control": "public, max-age=3600", "x-redirect-source": "legacy-guide" },
  });
}

export function canonicalHostRedirect(request: Request): Response | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if (url.hostname.toLowerCase() !== `www.${CANONICAL_HOST}`) return null;

  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  // url.pathname and url.search are carried over untouched, so a link to
  // www.xtsy.one/tab-bistro?utm_source=x keeps both its path and its campaign.
  return new Response(null, {
    status: 301,
    headers: {
      location: url.toString(),
      "cache-control": "public, max-age=3600",
      "x-redirect-source": "canonical-host",
      "strict-transport-security": HSTS,
    },
  });
}

/**
 * Public HTML (same rules as the page cache: no booking/admin/api, no cookies) may be kept by the
 * CDN for an hour; browsers always revalidate. The build id is not in the URL, so a publish can
 * take up to an hour to show at the edge (stale-while-revalidate refreshes in the background).
 */
function withEdgeCacheHeaders(request: Request, response: Response): Response {
  let key: string | null = null;
  try { key = cacheKey(request); } catch { key = null; }
  if (!key || response.status !== 200) return response;
  if (!(response.headers.get("content-type") ?? "").includes("text/html") || response.headers.has("set-cookie")) return response;
  // No CDN HTML caching: a CDN copy outlives a publish and points at deleted /assets/* files
  // (Ahrefs 18 Nov 2026: 335 pages with broken JS/CSS). The build-keyed page cache keeps TTFB low.
  const value = "public, max-age=0, must-revalidate";
  try {
    response.headers.set("cache-control", value);
    return response;
  } catch {
    const out = new Response(response.body, response);
    out.headers.set("cache-control", value);
    return out;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const hostRedirect = canonicalHostRedirect(request);
    if (hostRedirect) return hostRedirect;
    const legacy = legacyRedirect(request);
    if (legacy) return legacy;
    const guide = await guideRedirect(request);
    if (guide) return guide;

    try {
      const handler = await getServerEntry();
      // Public pages are served from the page cache when possible (see src/lib/pageCache.ts).
      const response = await withPageCache(request, ctx, async () =>
        normalizeCatastrophicSsrResponse(await handler.fetch(request.clone(), env, ctx)),
      );
      return withEdgeCacheHeaders(request, withFrameProtection(request, withGoneStatus(request, response)));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
