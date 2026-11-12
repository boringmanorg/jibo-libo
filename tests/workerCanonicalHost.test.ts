/**
 * The 12 Nov crawl found the whole site served on both hosts: 712 pages on
 * www.xtsy.one and 721 on xtsy.one, identical content. Canonical tags pointed at
 * the apex, but a canonical is a hint, so both were indexed and every audit count
 * was inflated roughly 2x. The worker now 301s www to the apex.
 *
 * These tests exist so that redirect cannot regress, and so the apex itself is
 * never caught by it (which would be an infinite loop on every request).
 */
import { describe, expect, it, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

let worker: { fetch: (r: Request, e: unknown, c: unknown) => Promise<Response> };
const env = { SITE_ORIGIN: 'https://xtsy.one' };
const ctx = { waitUntil() {}, passThroughOnException() {} };

beforeAll(async () => {
  (globalThis as any).HTMLRewriter = class {
    on() { return this; }
    transform(r: Response) { return r; }
  };
  const mapPath = path.resolve(process.cwd(), 'public', 'seo-redirect-map.json');
  const map = fs.existsSync(mapPath) ? fs.readFileSync(mapPath, 'utf8') : '{}';
  vi.stubGlobal('fetch', async (input: RequestInfo) => {
    const u = typeof input === 'string' ? input : (input as Request).url;
    if (u.endsWith('/seo-redirect-map.json')) {
      return new Response(map, { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('<html><head><title>x</title></head><body>ok</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  });
  worker = (await import('../cloudflare/worker.js')).default;
});

const get = (url: string) =>
  worker.fetch(new Request(url, { headers: { 'user-agent': 'curl/8' } }), env, ctx);

describe('canonical host', () => {
  it('301s www to the apex', async () => {
    const r = await get('https://www.xtsy.one/');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://xtsy.one/');
  });

  it('preserves path and query across the redirect', async () => {
    const r = await get('https://www.xtsy.one/tab-bistro?utm_source=x&a=1');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://xtsy.one/tab-bistro?utm_source=x&a=1');
  });

  it('matches the host case-insensitively', async () => {
    const r = await get('https://WWW.xtsy.one/about');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://xtsy.one/about');
  });

  it('never redirects the apex, which would loop forever', async () => {
    const r = await get('https://xtsy.one/tab-bistro');
    expect(r.status).not.toBe(301);
    expect(r.headers.get('x-redirect-source')).not.toBe('canonical-host');
  });

  it('sends HSTS on the redirect, so the hop is not a downgrade point', async () => {
    const r = await get('https://www.xtsy.one/');
    expect(r.headers.get('Strict-Transport-Security')).toContain('max-age=');
  });

  it('no longer allows Supabase in connect-src', async () => {
    const r = await get('https://xtsy.one/');
    const csp = r.headers.get('Content-Security-Policy') ?? '';
    expect(csp).not.toContain('supabase.co');
  });
});
