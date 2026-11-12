/**
 * Cloudflare Worker — Dynamic Rendering for XTSY SEO Pages
 * 
 * Detects search engine bots and serves pre-rendered static HTML.
 * Regular users get the normal SPA experience.
 * 
 * Deploy: Workers & Pages → Create Worker → paste this code
 * Route: xtsy.one/* (after pointing DNS through Cloudflare)
 */

// Set at deploy time so the probe identifies which build answered.
const BUILD_STAMP = '2026-10-30T08:45Z';

// Bot user-agent patterns
const BOT_AGENTS = [
  'googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'slurp',
  'baiduspider', 'facebookexternalhit', 'facebot', 'twitterbot',
  'linkedinbot', 'whatsapp', 'telegrambot', 'applebot', 'pinterest',
  'pinterestbot', 'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot',
  'petalbot', 'bytespider', 'gptbot', 'oai-searchbot', 'chatgpt-user',
  'perplexitybot', 'claudebot', 'claude-web', 'anthropic-ai',
  'ccbot', 'cohere-ai', 'mistralai-user',
  'ia_archiver', 'archive.org_bot',
  'slackbot', 'discordbot', 'redditbot', 'embedly', 'skypeuripreview',
  'msnbot', 'qwantbot', 'mojeekbot', 'seznambot',
  // Google specific
  'googlebot-mobile', 'google-inspectiontool', 'google-structured-data-testing-tool',
  'mediapartners-google', 'adsbot-google', 'apis-google',
  'feedfetcher-google', 'google-read-aloud',
];

// AI crawlers are WELCOMED (SEO master prompt, Part 7a): robots.txt explicitly
// allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended etc., so the edge
// must not 403 them — AI engines can't cite pages they cannot fetch.
// Only abusive scrapers with no answer-engine value stay blocked.
const BLOCKED_AI_AGENTS = [
  'bytespider', 'omgilibot', 'petalbot',
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_AGENTS.some(bot => ua.includes(bot));
}

function isBlockedAIBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BLOCKED_AI_AGENTS.some(bot => ua.includes(bot));
}

// Generate pre-rendered HTML for SEO pages
function generateSEOHTML(url, originalHTML) {
  const path = new URL(url).pathname.replace(/\/$/, '') || '/';
  
  // For the homepage, return as-is (it's already indexed)
  if (path === '/' || path === '') return null;

  // Build a minimal but SEO-complete HTML page
  // The content will be injected before the SPA shell
  return null; // We'll use KV store for pre-rendered content
}

// In-memory micro-caches (per worker isolate)
const REDIRECT_CACHE = new Map();
const REDIRECT_TTL_MS = 60_000;

// SEO slim map cache — fetched from /seo-slim-map.json once per isolate.
let SLIM_MAP_CACHE = null;
let SLIM_MAP_FETCHED_AT = 0;
const SLIM_MAP_TTL_MS = 5 * 60_000;

async function getSlimMapEntry(slug, origin, env) {
  // KV path — fast per-slug lookup; populated by the deploy workflow.
  if (env && env.SEO_SLIM_MAP) {
    try {
      const v = await env.SEO_SLIM_MAP.get(slug, 'json');
      if (v) return v;
    } catch (_) { /* fall through */ }
  }
  // Origin fallback — fetched once per isolate, in-memory cached.
  if (!SLIM_MAP_CACHE || Date.now() - SLIM_MAP_FETCHED_AT >= SLIM_MAP_TTL_MS) {
    try {
      const res = await fetch(`${origin}/seo-slim-map.json`, {
        cf: { cacheTtl: 3600, cacheEverything: true },
      });
      if (res.ok) {
        SLIM_MAP_CACHE = await res.json();
        SLIM_MAP_FETCHED_AT = Date.now();
      }
    } catch (_) { /* keep prior cache */ }
  }
  return (SLIM_MAP_CACHE && SLIM_MAP_CACHE[slug]) || null;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Build an HTMLRewriter that bakes per-route canonical/og:url/og:title/
 * og:description/twitter/<title>/<meta name="description"> into the response
 * head. Runs for ALL HTML responses (users + bots) so non-JS preview crawlers
 * (Slack, Facebook, LinkedIn) see route-correct metadata before any JS.
 */
function makeSeoRewriter(canonical, entry, extraHeaderMeta) {
  let titleHandled = false;
  let descHandled = false;
  let canonicalHandled = false;
  let ogUrlHandled = false;
  let ogTitleHandled = false;
  let ogDescHandled = false;
  let twTitleHandled = false;
  let twDescHandled = false;

  const title = entry && entry.t;
  const desc = entry && entry.d;

  return new HTMLRewriter()
    .on('title', {
      text(text) {
        if (titleHandled || !title) return;
        if (text.lastInTextNode) {
          text.replace(title, { html: false });
          titleHandled = true;
        } else {
          text.remove();
        }
      },
    })
    .on('meta[name="description"]', {
      element(el) { if (desc) { el.setAttribute('content', desc); descHandled = true; } },
    })
    .on('link[rel="canonical"]', {
      element(el) { el.setAttribute('href', canonical); canonicalHandled = true; },
    })
    .on('meta[property="og:url"]', {
      element(el) { el.setAttribute('content', canonical); ogUrlHandled = true; },
    })
    .on('meta[property="og:title"]', {
      element(el) { if (title) { el.setAttribute('content', title); ogTitleHandled = true; } },
    })
    .on('meta[property="og:description"]', {
      element(el) { if (desc) { el.setAttribute('content', desc); ogDescHandled = true; } },
    })
    .on('meta[name="twitter:title"]', {
      element(el) { if (title) { el.setAttribute('content', title); twTitleHandled = true; } },
    })
    .on('meta[name="twitter:description"]', {
      element(el) { if (desc) { el.setAttribute('content', desc); twDescHandled = true; } },
    })
    .on('head', {
      element(el) {
        // Append fallbacks for tags that didn't exist in the static head.
        if (!canonicalHandled) el.append(`<link rel="canonical" href="${escapeAttr(canonical)}">`, { html: true });
        if (!ogUrlHandled)     el.append(`<meta property="og:url" content="${escapeAttr(canonical)}">`, { html: true });
        if (title) {
          if (!ogTitleHandled) el.append(`<meta property="og:title" content="${escapeAttr(title)}">`, { html: true });
          if (!twTitleHandled) el.append(`<meta name="twitter:title" content="${escapeAttr(title)}">`, { html: true });
        }
        if (desc) {
          if (!descHandled)    el.append(`<meta name="description" content="${escapeAttr(desc)}">`, { html: true });
          if (!ogDescHandled)  el.append(`<meta property="og:description" content="${escapeAttr(desc)}">`, { html: true });
          if (!twDescHandled)  el.append(`<meta name="twitter:description" content="${escapeAttr(desc)}">`, { html: true });
        }
        if (extraHeaderMeta) el.append(extraHeaderMeta, { html: true });
      },
    });
}

let REDIRECT_MAP_CACHE = null;
let REDIRECT_MAP_FETCHED_AT = 0;
const REDIRECT_MAP_TTL_MS = 5 * 60_000;

/**
 * Static 301/410 lookup. Replaces the seo-redirect-resolver Supabase edge function,
 * which queried a seo_redirects table on every request; the site has no database
 * dependency, so the map now ships with the build (scripts/generateWorkerRedirectMap.ts
 * -> public/seo-redirect-map.json).
 *
 * Same KV-then-origin shape as the slim map: per-path KV when SEO_REDIRECT_MAP is
 * bound, otherwise the JSON fetched once per isolate and cached in memory.
 */
async function resolveLegacyRedirect(path, env) {
  const key = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;

  if (env && env.SEO_REDIRECT_MAP) {
    try {
      const v = await env.SEO_REDIRECT_MAP.get(key, 'json');
      if (v) return { target: v.t ?? null, status: v.s || 301 };
    } catch (_) { /* fall through to the origin copy */ }
  }

  if (!REDIRECT_MAP_CACHE || Date.now() - REDIRECT_MAP_FETCHED_AT >= REDIRECT_MAP_TTL_MS) {
    try {
      const res = await fetch(`${env.SITE_ORIGIN || 'https://xtsy.one'}/seo-redirect-map.json`, {
        cf: { cacheTtl: 3600, cacheEverything: true },
      });
      if (res.ok) {
        REDIRECT_MAP_CACHE = await res.json();
        REDIRECT_MAP_FETCHED_AT = Date.now();
      }
    } catch (_) { /* keep whatever cache we have */ }
  }

  const hit = REDIRECT_MAP_CACHE && REDIRECT_MAP_CACHE[key];
  return hit ? { target: hit.t ?? null, status: hit.s || 301 } : null;
}

/* ── First-party Contentsquare/Hotjar proxy ──────────────────────────────────
 * Ported from the cs-proxy Supabase edge function, which was a pure allow-listed
 * HTTP proxy with no database access. Doing it here removes the Supabase hop
 * entirely and saves a round trip on every cache miss.
 */
const CS_DEFAULT_ORIGIN = 'https://t.contentsquare.net';
const CS_ALLOWED_HOST_SUFFIXES = ['.contentsquare.net', '.hotjar.com', '.hotjar.io'];
const CS_ALLOWED_PREFIXES = ['uxa', 't', 'log', 'logs', 'b', 'bb', 'pl', 'c', 'm', 'd', 'i', 's', 'hm'];

function resolveCsProxyTarget(subPath, search = '') {
  const sub = (subPath || '').replace(/^\/+/, '');
  if (!sub) return { ok: false, reason: 'empty path', status: 404 };
  if (sub.includes('..') || !/^[A-Za-z0-9._/-]+$/.test(sub)) {
    return { ok: false, reason: 'invalid path', status: 400 };
  }
  if (sub.startsWith('h/')) {
    const rest = sub.slice(2);
    const slash = rest.indexOf('/');
    if (slash <= 0) return { ok: false, reason: 'missing host or path', status: 400 };
    const host = rest.slice(0, slash).toLowerCase();
    const hostPath = rest.slice(slash + 1);
    if (!/^[a-z0-9.-]+$/.test(host) || !CS_ALLOWED_HOST_SUFFIXES.some((x) => host.endsWith(x))) {
      return { ok: false, reason: `host not allowed: ${host}`, status: 403 };
    }
    if (!hostPath) return { ok: false, reason: 'empty host path', status: 400 };
    return { ok: true, upstreamUrl: `https://${host}/${hostPath}${search}` };
  }
  const prefix = sub.split('/')[0];
  if (!CS_ALLOWED_PREFIXES.includes(prefix)) {
    return { ok: false, reason: `prefix not allowed: ${prefix}`, status: 403 };
  }
  return { ok: true, upstreamUrl: `${CS_DEFAULT_ORIGIN}/${sub}${search}` };
}

function inferCsContentType(p) {
  const x = p.toLowerCase().split('?')[0];
  if (x.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (x.endsWith('.json')) return 'application/json; charset=utf-8';
  if (x.endsWith('.css')) return 'text/css; charset=utf-8';
  if (x.endsWith('.gif')) return 'image/gif';
  if (x.endsWith('.png')) return 'image/png';
  if (x.endsWith('.svg')) return 'image/svg+xml';
  if (x.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

async function serveCsProxy(request, url) {
  const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, range',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-max-age': '86400',
  };
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS });
  }

  const resolved = resolveCsProxyTarget(url.pathname.slice('/cs/'.length), url.search);
  if (!resolved.ok) {
    return new Response(resolved.reason ?? 'Invalid path', {
      status: resolved.status ?? 400,
      headers: { ...CORS, 'cache-control': 'no-store' },
    });
  }

  try {
    const range = request.headers.get('range');
    const upstream = await fetch(resolved.upstreamUrl, {
      method: request.method,
      headers: {
        'user-agent': request.headers.get('user-agent') ?? 'xtsy-cs-proxy/1.0',
        accept: request.headers.get('accept') ?? '*/*',
        ...(range ? { range } : {}),
      },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!upstream.ok) {
      return new Response(`Upstream error ${upstream.status}`, {
        status: upstream.status,
        headers: { ...CORS, 'cache-control': 'no-store' },
      });
    }
    const h = new Headers(CORS);
    h.set('content-type', upstream.headers.get('content-type') ?? inferCsContentType(resolved.upstreamUrl));
    h.set('cache-control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    h.set('x-proxied-by', 'xtsy-cs-proxy');
    h.set('x-rendered-by', 'cf-cs-proxy');
    h.set('x-upstream', new URL(resolved.upstreamUrl).origin);
    return new Response(upstream.body, { status: 200, headers: h });
  } catch (err) {
    return new Response(`Proxy failure: ${err && err.message ? err.message : String(err)}`, {
      status: 502,
      headers: { ...CORS, 'cache-control': 'no-store' },
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // ── Canonical host: 301 www → apex ───────────────────────────────────────
    // Both hosts served 200 for the whole site, so every page existed twice. The
    // 12 Nov crawl found 712 pages on www and 721 on the apex: identical content,
    // double the crawl budget, and every audit count inflated ~2x. Canonical tags
    // already pointed at the apex, but a canonical is a hint and a 301 is not.
    // Placed before everything else so no other path can answer on www.
    if (url.hostname.toLowerCase().startsWith('www.')) {
      const target = new URL(url);
      target.hostname = url.hostname.slice(4);
      return new Response(null, {
        status: 301,
        headers: {
          location: target.toString(),
          'cache-control': 'public, max-age=3600',
          'x-redirect-source': 'canonical-host',
          'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
        },
      });
    }

    // --- Liveness probe -------------------------------------------------
    // Returns before every other code path, so a response here proves the
    // route dispatches to this Worker. While the routes are limited to this
    // single path it is also the only thing the Worker serves. Keep it: it is
    // how a future deploy is verified, and it is cheap and unlinked.
    if (url.pathname === '/__xtsy_worker_probe') {
      return new Response(`worker-alive name=xtsy-edge-seo built=${BUILD_STAMP}`, {
        status: 200,
        headers: {
          'content-type': 'text/plain;charset=utf-8',
          'cache-control': 'no-store',
          'x-rendered-by': 'cf-probe',
        },
      });
    }

    // Skip for non-HTML requests (assets, API calls, etc.)
    const path = url.pathname;

    // --- First-party Contentsquare/Hotjar proxy ---
    // Serving the tag from a first-party path defeats domain-based blocklists
    // (uBlock/Brave/AdGuard). Handled here directly; it used to hop through the
    // cs-proxy Supabase edge function, which this Worker no longer needs.
    if (path.startsWith('/cs/')) {
      return serveCsProxy(request, url);
    }

    if (
      path.startsWith('/assets/') ||
      path.startsWith('/api/') ||
      path.match(/\.(js|css|png|jpg|jpeg|webp|avif|svg|ico|woff2?|ttf|eot|map|json|xml|txt|pdf)$/i)
    ) {
      return fetch(request);
    }


    // --- Block AI training scrapers (CF Security Insights: moderate) ---
    if (isBlockedAIBot(userAgent)) {
      return new Response('AI training crawl disallowed. See /robots.txt and /.well-known/security.txt', {
        status: 403,
        headers: {
          'content-type': 'text/plain;charset=utf-8',
          'x-blocked-by': 'cf-ai-bot-guard',
          'cache-control': 'public, max-age=86400',
        },
      });
    }

    // --- Legacy URL → real 301 redirects (applies to bots AND users) ---
    // Looks the path up in the static redirect map built at prebuild and issues a
    // true HTTP 301/410 instead of relying on the SPA's <Navigate replace>.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const redirect = await resolveLegacyRedirect(path, env);
      if (redirect && redirect.target) {
        const targetUrl = redirect.target.startsWith('http')
          ? redirect.target
          : `${url.origin}${redirect.target.startsWith('/') ? '' : '/'}${redirect.target}${url.search}`;
        return new Response(null, {
          status: redirect.status || 301,
          headers: {
            location: targetUrl,
            'cache-control': 'public, max-age=3600',
            'x-redirect-source': 'static-redirect-map',
            'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
          },
        });
      }
      // A 410 carries no target. The previous version guarded on `redirect.target`,
      // so retired slugs fell through and answered 200 — Google kept them indexed.
      if (redirect && redirect.status === 410) {
        return new Response('Gone', {
          status: 410,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600',
            'x-redirect-source': 'static-redirect-map',
            'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
          },
        });
      }
    }

    // --- SEO head rewrite (applies to BOTH bots and human visitors) ---
    // Resolves the slim per-route map, then rewrites canonical/og:url/og:title/
    // og:description/twitter/<title>/<meta name="description"> at the edge so
    // non-JS preview crawlers (Slack, Facebook, LinkedIn) and curl-based audits
    // see route-correct metadata before the SPA hydrates.
    const slug = path.replace(/^\/|\/$/g, '');
    const canonical = `${url.origin}${slug ? '/' + slug : '/'}`;
    const entry = await getSlimMapEntry(slug, url.origin, env);

    // Bot path: try KV pre-render first, fall back to origin + rewrite
    if (isBot(userAgent)) {
      console.log(`🤖 Bot detected: ${userAgent.substring(0, 80)} → ${path}`);
      if (env.PRERENDER_CACHE) {
        const cacheKey = path === '/' ? '/' : path.replace(/\/$/, '');
        const cached = await env.PRERENDER_CACHE.get(cacheKey, 'text');
        if (cached) {
          console.log(`✅ Serving pre-rendered: ${cacheKey}`);
          return new Response(cached, {
            headers: {
              'content-type': 'text/html;charset=utf-8',
              'x-rendered-by': 'cloudflare-prerender',
              'cache-control': 'public, max-age=86400, s-maxage=604800',
            },
          });
        }
      }
    }

    // Fetch origin and rewrite head for ALL HTML responses
    const response = await fetch(request);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;

    const extraMeta = isBot(userAgent) ? '<meta name="x-rendered-for" content="bot">' : null;
    const rewritten = makeSeoRewriter(canonical, entry, extraMeta).transform(response);
    const newResponse = new Response(rewritten.body, rewritten);
    newResponse.headers.set('x-rendered-by', isBot(userAgent) ? 'cf-bot-rewrite' : 'cf-edge-rewrite');
    newResponse.headers.set('x-seo-entry', entry ? 'matched' : 'fallback');

    // ── Security headers (mirror public/_headers for Worker-served HTML) ──
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newResponse.headers.set(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), bluetooth=(), interest-cohort=()'
    );
    newResponse.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
    newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    newResponse.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    newResponse.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data: blob: https:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.googletagmanager.com https://tagmanager.google.com",
        "font-src 'self' data: https://fonts.gstatic.com https://*.hotjar.com",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.googletagmanager.com https://tagmanager.google.com https://www.google-analytics.com https://ssl.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.googlesyndication.com https://pagead2.googlesyndication.com https://adservice.google.com https://www.gstatic.com https://ssl.gstatic.com https://www.google.com https://www.google.co.in https://tagassistant.google.com https://t.contentsquare.net https://*.contentsquare.net https://script.hotjar.com https://static.hotjar.com",
        "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://region1.google-analytics.com https://www.googletagmanager.com https://*.googletagmanager.com https://tagassistant.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net https://td.doubleclick.net https://*.g.doubleclick.net https://adservice.google.com https://www.google.com https://www.google.co.in https://pagead2.googlesyndication.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://fonts.googleapis.com https://fonts.gstatic.com https://t.contentsquare.net https://*.contentsquare.net https://*.hotjar.com https://*.hotjar.io https://ipapi.co https://*.doubleclick.net wss://*.hotjar.com",
        "frame-src 'self' https://www.googletagmanager.com https://tagassistant.google.com https://td.doubleclick.net https://*.doubleclick.net https://www.google.com https://*.hotjar.com",
        "frame-ancestors 'self' https://tagassistant.google.com https://tagmanager.google.com",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        'upgrade-insecure-requests',
      ].join('; ')
    );

    // ── Homepage LCP preload via Link header ──────────────────────────
    // Emits a Link: rel=preload for the hero AVIF on the homepage. When the
    // zone has Early Hints enabled, Cloudflare converts this into a 103 hint
    // sent before the origin HTML — measurably cuts mobile LCP.
    if (path === '/' || path === '') {
      // Must stay in step with HERO_IMAGE.mobile.avifSrc in src/data/v2Images.ts. Preloading
      // anything else costs every visitor an extra download of an image that is never shown.
      newResponse.headers.append(
        'Link',
        '</img/o/xtsy-property-images-8-portrait-828.avif>; rel=preload; as=image; type=image/avif; fetchpriority=high'
      );
    }
    return newResponse;
  },
};
