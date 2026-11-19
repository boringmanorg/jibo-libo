import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isChunkLoadError, shouldReloadForStaleDeploy } from '../src/components/ErrorBoundary';

describe('stale deploy recovery', () => {
  it('recognises chunk load errors from each browser', () => {
    for (const m of [
      'Failed to fetch dynamically imported module: https://www.xtsy.one/assets/admin-abc.js',
      'Importing a module script failed.',
      'error loading dynamically imported module',
      'Loading chunk 42 failed.',
      'Unable to preload CSS for /assets/x.css',
    ]) expect(isChunkLoadError(m)).toBe(true);
    expect(isChunkLoadError("Cannot read properties of undefined (reading 'map')")).toBe(false);
  });
  it('reloads at most once a minute', () => {
    expect(shouldReloadForStaleDeploy(100_000, null)).toBe(true);
    expect(shouldReloadForStaleDeploy(100_000, 90_000)).toBe(false);
    expect(shouldReloadForStaleDeploy(200_000, 90_000)).toBe(true);
  });
  it('the error screen shows the real error and retries with a full reload', () => {
    const src = readFileSync('src/components/ErrorBoundary.tsx', 'utf8');
    expect(src).toMatch(/Error: \{this\.state\.error\.message\.slice\(0, 200\)\}/);
    expect(src).toMatch(/handleRetry = \(\) => \{\s*window\.location\.reload\(\);/);
    expect(src).not.toMatch(/This might be a network issue/);
  });
});
