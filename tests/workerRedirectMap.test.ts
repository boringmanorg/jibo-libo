/**
 * The Cloudflare worker serves 301s and 410s from a static map generated at
 * `prebuild`, replacing the seo-redirect-resolver Supabase edge function. These
 * tests guard the two things that silently break SEO: a malformed map, and the
 * worker failing to answer 410 for a retired slug (the previous implementation
 * guarded on `redirect.target`, so 410s fell through and answered 200).
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { RECOVERY_REDIRECTS } from '../src/data/seoAffectedSlugs';
import { GONE_SLUGS } from '../src/data/seoGoneSlugs';

type Entry = { t: string | null; s: number };
const MAP_PATH = path.resolve(process.cwd(), 'public', 'seo-redirect-map.json');
let map: Record<string, Entry>;

beforeAll(() => {
  if (!fs.existsSync(MAP_PATH)) {
    execFileSync('npx', ['-y', 'tsx', 'scripts/generateWorkerRedirectMap.ts'], { stdio: 'ignore' });
  }
  map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
});

describe('static redirect map', () => {
  it('is non-empty, so a generator failure cannot pass silently', () => {
    expect(Object.keys(map).length).toBeGreaterThan(50);
  });

  it('keys and targets are rooted paths', () => {
    for (const [source, entry] of Object.entries(map)) {
      expect(source.startsWith('/'), `source ${source}`).toBe(true);
      if (entry.t !== null) {
        expect(entry.t.startsWith('/') || entry.t.startsWith('http'), `target ${entry.t}`).toBe(true);
      }
    }
  });

  it('covers every RECOVERY_REDIRECTS entry as a 301 with a target', () => {
    for (const [source, target] of Object.entries(RECOVERY_REDIRECTS)) {
      const entry = map[source.startsWith('/') ? source : `/${source}`];
      expect(entry, `missing redirect for ${source}`).toBeDefined();
      // GONE wins over a stale recovery target, so only assert 301 when not gone.
      if (entry.s !== 410) {
        expect(entry.s).toBe(301);
        expect(entry.t).toBe(target.startsWith('/') ? target : `/${target}`);
      }
    }
  });

  it('covers every GONE_SLUG as a 410 with no target', () => {
    for (const slug of GONE_SLUGS) {
      const entry = map[slug.startsWith('/') ? slug : `/${slug}`];
      expect(entry, `missing gone entry for ${slug}`).toBeDefined();
      expect(entry.s).toBe(410);
      expect(entry.t).toBeNull();
    }
  });

  it('never redirects to a path that is itself gone or redirected', () => {
    for (const [source, entry] of Object.entries(map)) {
      if (entry.s !== 301 || !entry.t) continue;
      const hop = map[entry.t.replace(/\/$/, '')];
      expect(hop, `${source} -> ${entry.t} chains to another rule`).toBeUndefined();
    }
  });

  it('410 takes precedence when a slug appears in both sources', () => {
    for (const slug of GONE_SLUGS) {
      const key = slug.startsWith('/') ? slug : `/${slug}`;
      if (key.slice(1) in RECOVERY_REDIRECTS) expect(map[key].s).toBe(410);
    }
  });
});
