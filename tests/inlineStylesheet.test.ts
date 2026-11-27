import { describe, expect, it } from 'vitest';
import { routeHeroPreload, withInlineStylesheet } from '@/lib/inlineStylesheet.server';

const CSS = 'body{color:red}';
const HEAD = '<!DOCTYPE html><html><head><meta charSet="utf-8"/><link rel="preload" as="image" href="/logo.webp"/>'
  + '<link rel="stylesheet" href="/assets/styles-AbC123.css" data-precedence="default"/><link rel="modulepreload" href="/assets/main.js"/></head>';
const BODY = '<body><h1>Hello</h1></body></html>';

/** An HTML response delivered in small pieces, as a streamed render is. */
function htmlResponse(html: string, type = 'text/html; charset=utf-8', status = 200) {
  const bytes = new TextEncoder().encode(html);
  const body = new ReadableStream<Uint8Array>({
    start(c) { for (let i = 0; i < bytes.length; i += 37) c.enqueue(bytes.slice(i, i + 37)); c.close(); },
  });
  return new Response(body, { status, headers: { 'content-type': type, 'content-length': String(bytes.length) } });
}

describe('stylesheet inline in server-rendered HTML', () => {
  it('puts the stylesheet inline at the end of <head> and parks the linked copy until load', async () => {
    const res = withInlineStylesheet(htmlResponse(HEAD + BODY), CSS, '<link rel="preload" as="image" href="/hero.avif"/>');
    const html = await res.text();
    expect(res.headers.get('content-length')).toBeNull();
    expect(html).toContain('<link rel="preload" as="image" href="/hero.avif"/><link rel="stylesheet" data-href="/assets/styles-AbC123.css" data-precedence="default" data-deferred-css/>');
    expect(html).not.toMatch(/<link rel="stylesheet" href=/); // nothing blocks the first paint
    expect(html).toMatch(/<link rel="modulepreload" href="\/assets\/main.js"\/><style data-inline-css>body\{color:red\}<\/style><script>[^<]*data-deferred-css[^<]*<\/script><\/head><body><h1>Hello<\/h1>/);
    expect(html.endsWith(BODY)).toBe(true);
  });

  it('a stylesheet can never close its own <style> element early', async () => {
    const html = await withInlineStylesheet(htmlResponse(HEAD + BODY), 'a{content:"</style><script>x()</script>"}').text();
    expect(html).not.toContain('</style><script>x()');
  });

  it('leaves other responses alone', async () => {
    const json = htmlResponse('{"a":1}', 'application/json');
    expect(withInlineStylesheet(json, CSS)).toBe(json);
    const notFound = htmlResponse(HEAD + BODY, 'text/html', 404);
    expect(withInlineStylesheet(notFound, CSS)).toBe(notFound);
    const noLink = await withInlineStylesheet(htmlResponse('<html><head><title>x</title></head><body></body></html>'), CSS).text();
    expect(noLink).toBe('<html><head><title>x</title></head><body></body></html>');
  });
});

describe('largest-photo preloads', () => {
  it('a guide page with a photo band preloads that photo, AVIF first, at full width', () => {
    const tag = routeHeroPreload('/destinations/meghalaya/shillong');
    expect(tag).toMatch(/^<link rel="preload" as="image" type="image\/avif" imagesrcset="[^"]*hero-shillong-828\.avif 828w[^"]*" imagesizes="100vw" fetchpriority="high"\/>$/);
  });

  it('/guides preloads its first topic card', () => {
    expect(routeHeroPreload('/guides')).toMatch(/imagesrcset="[^"]+\.avif \d+w/);
  });

  it('pages without a photo band get nothing', () => {
    expect(routeHeroPreload('/')).toBe('');
    expect(routeHeroPreload('/book')).toBe('');
  });
});
