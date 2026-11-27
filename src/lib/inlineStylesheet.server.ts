/**
 * First paint without waiting for the stylesheet.
 *
 * On a phone on slow 4G the site's stylesheet (33 KB compressed) competes with ~400 KB of scripts
 * and only finishes ~2.3 s in; until then nothing is painted, so text-first pages showed their
 * first words at ~2.3 s (lab LCP audit, 26 Nov 2026). Server-rendered HTML pages now carry the same
 * stylesheet inline in <head>, so the browser can paint as soon as the HTML arrives, and the linked
 * copy is switched on only after the page has loaded. Both hold the same
 * rules, so nothing looks different; only the order of arrival changes.
 *
 * Server only (imported from src/server.ts): the CSS text never enters the browser's scripts.
 */
import appCssText from '../styles.css?inline';
import { routeHero } from '@/data/routeHeroes';
import { guideTopicPhoto } from '@/data/guideTopicPhotos';
import { guidesPayload } from '@/lib/seo/guidePageData';
import { avifSrcSet, responsiveImage } from '@/data/cdnImages';

const LINK = /<link rel="stylesheet" href="(\/assets\/styles-[A-Za-z0-9_-]+\.css)"([^>]*)\/?>/;
/** Give up looking after this much HTML (the link sits in <head>, well inside it). */
const MAX_SCAN = 256 * 1024;

/**
 * The linked copy, parked until the page has loaded: its address waits in data-href (browsers fetch
 * even a disabled stylesheet), so its 29 KB never competes with the hero photo and fonts; the
 * inline copy already styles the page. After "load" the address goes back and it is an ordinary,
 * loaded stylesheet for the app (exported for tests).
 */
export function deferredLink(href: string, rest: string): string {
  return `<link rel="stylesheet" data-href="${href}"${rest.replace(/\s*\/$/, '')} data-deferred-css/>`;
}
const ENABLE_AFTER_LOAD = `<script>addEventListener('load',function(){setTimeout(function(){document.querySelectorAll('link[data-deferred-css]').forEach(function(l){l.href=l.getAttribute('data-href')})},0)})</script>`;

/** The inline copy of the stylesheet (exported for tests). "</style" can never end it early. */
export function inlineStyle(css = appCssText): string {
  return `<style data-inline-css>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
}

const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function imagePreload(src: string, sizes: string): string {
  const opt = responsiveImage(src);
  const avif = opt?.avifSrcSet ?? avifSrcSet(opt?.srcSet);
  if (opt && avif) return `<link rel="preload" as="image" type="image/avif" imagesrcset="${attr(avif)}" imagesizes="${attr(sizes)}" fetchpriority="high"/>`;
  return `<link rel="preload" as="image" href="${attr(opt?.src ?? src)}"${opt ? ` imagesrcset="${attr(opt.srcSet)}" imagesizes="${attr(sizes)}"` : ''} fetchpriority="high"/>`;
}

/**
 * A head preload for the largest photo of pages whose photo sits in the body with no preload of
 * its own, so it starts before the inline stylesheet's bytes. Same AVIF set and sizes as the <img>,
 * so the browser fetches it once.
 * - The photo band at the top of many guide pages (src/data/routeHeroes.ts).
 * - The first topic card on /guides (the largest thing on a phone's first screen).
 */
export function routeHeroPreload(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/guides') {
    const first = guidesPayload().groups[0];
    return first ? imagePreload(guideTopicPhoto(first.label).src, '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw') : '';
  }
  const hero = routeHero(path);
  return hero ? imagePreload(hero.src, '100vw') : '';
}

/**
 * Rewrites an HTML response's <head>: the stylesheet link stops blocking, and the stylesheet goes
 * inline just before </head>, after the hero-image, font and script preloads, so the browser has
 * already started those when the CSS bytes arrive. Anything else passes through untouched.
 */
export function withInlineStylesheet(response: Response, css = appCssText, extraHead = ''): Response {
  const type = response.headers.get('content-type') ?? '';
  if (response.status !== 200 || !/^text\/html/i.test(type) || !response.body || !css) return response;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let done = false;
  const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (done) { controller.enqueue(chunk); return; }
      buffer += decoder.decode(chunk, { stream: true });
      const end = buffer.search(/<\/head>/i);
      if (end < 0 && buffer.length < MAX_SCAN) return; // keep reading until the end of <head>
      done = true;
      if (end >= 0) {
        const head = buffer.slice(0, end);
        const m = LINK.exec(head);
        if (m) buffer = head.slice(0, m.index) + extraHead + deferredLink(m[1], m[2]) + head.slice(m.index + m[0].length) + inlineStyle(css) + ENABLE_AFTER_LOAD + buffer.slice(end);
      }
      controller.enqueue(encoder.encode(buffer));
      buffer = '';
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer) controller.enqueue(encoder.encode(buffer));
    },
  }));
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
