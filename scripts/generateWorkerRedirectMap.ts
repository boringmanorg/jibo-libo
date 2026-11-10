/**
 * Emits `public/seo-redirect-map.json` — the static 301/410 map consumed by
 * `cloudflare/worker.js` at the edge.
 *
 * This replaces the `seo-redirect-resolver` Supabase edge function, which read a
 * `seo_redirects` table on every request. The site has no database dependency, so
 * the data now ships with the build from the sources that already live in the repo:
 *
 *   RECOVERY_REDIRECTS (seoAffectedSlugs.ts)  → 301 to the given target
 *   GONE_SLUGS         (seoGoneSlugs.ts)      → 410, no target
 *
 * MERGED_REDIRECT_SLUGS is deliberately NOT a source: it only filters pages out of
 * the registry and carries no targets. Anything merged that needs a redirect has an
 * entry in RECOVERY_REDIRECTS.
 *
 * Output schema (one JSON object, keyed by leading-slash path):
 *   {
 *     "/old-path": { "t": "/new-path", "s": 301 },
 *     "/retired":  { "t": null,        "s": 410 }
 *   }
 *
 * Run as part of build (`prebuild`) and kept in /public so it ships beside the SPA
 * bundle and the worker can fetch it from the same origin, exactly like the slim map.
 */
import fs from 'fs';
import path from 'path';

type Entry = { t: string | null; s: number };

async function main() {
  const { RECOVERY_REDIRECTS } = await import('../src/data/seoAffectedSlugs');
  const { GONE_SLUGS } = await import('../src/data/seoGoneSlugs');

  const map: Record<string, Entry> = {};
  const norm = (p: string) => (p.startsWith('/') ? p : `/${p}`);

  for (const [source, target] of Object.entries(RECOVERY_REDIRECTS)) {
    map[norm(source)] = { t: norm(target), s: 301 };
  }

  // 410 wins over a 301: a slug listed as gone is gone, even if an older
  // recovery target still points somewhere.
  for (const slug of GONE_SLUGS) {
    map[norm(slug)] = { t: null, s: 410 };
  }

  const out = path.resolve(process.cwd(), 'public', 'seo-redirect-map.json');
  fs.writeFileSync(out, JSON.stringify(map));

  const gone = Object.values(map).filter((e) => e.s === 410).length;
  console.log(
    `✅ seo-redirect-map.json: ${Object.keys(map).length} entries ` +
      `(${Object.keys(map).length - gone} × 301, ${gone} × 410) → ` +
      `${(JSON.stringify(map).length / 1024).toFixed(1)} KB`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
