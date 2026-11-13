import { describe, it, expect } from 'vitest';
import { canonicalHostRedirect } from '@/server';

const at = (url: string) => canonicalHostRedirect(new Request(url));

describe('canonical host redirect', () => {
  it('301s www to the apex, keeping path and query', () => {
    const r = at('https://www.xtsy.one/tab-bistro?utm_source=x&utm_medium=y');
    expect(r?.status).toBe(301);
    expect(r?.headers.get('location')).toBe('https://xtsy.one/tab-bistro?utm_source=x&utm_medium=y');
  });

  it('upgrades an http www request to https on the apex', () => {
    expect(at('http://www.xtsy.one/rooms')?.headers.get('location')).toBe('https://xtsy.one/rooms');
  });

  it('carries HSTS on the redirect itself', () => {
    expect(at('https://www.xtsy.one/')?.headers.get('strict-transport-security')).toContain('max-age=');
  });

  // A redirect that fires on the apex is an infinite loop, and one that fires
  // in development breaks every local request. Both are worth pinning.
  it('never fires on the apex, localhost, or a preview host', () => {
    for (const u of [
      'https://xtsy.one/tab-bistro',
      'http://localhost:8080/tab-bistro',
      'http://127.0.0.1:3000/',
      'https://preview.xtsy.one/',
      'https://xtsy.one.evil.test/',
    ]) {
      expect(at(u), u).toBeNull();
    }
  });

  it('matches the host case-insensitively', () => {
    expect(at('https://WWW.XTSY.ONE/rooms')?.status).toBe(301);
  });
});
