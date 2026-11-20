/**
 * Writes public/search-pages.json: every page in the sitemaps with its title, a short description
 * and a section, for the site search. Run after sitemaps change:  npm run search:pages  (vite-node, because the data files import images)
 * (tests/quickSearch.test.ts fails when a sitemap page is missing from the file).
 */
import fs from 'node:fs';
import path from 'node:path';
import { STATIC_PAGE_DIRECTORY } from '../src/data/staticPageDirectory';
import { SIGNATURE_PACKAGES } from '../src/data/signaturePackages';
import { NE_STATES, destinationPath } from '../src/data/neTaxonomy';
import { getAllTours } from '../src/data/travelData';
import { meghalayaDestinations } from '../src/data/meghalayaDestinations';

const pub = path.resolve('public');
const urls = new Set<string>();
for (const f of fs.readdirSync(pub).filter((f) => /^sitemap-.*\.xml$/.test(f) && f !== 'sitemap-images.xml')) {
  for (const m of fs.readFileSync(path.join(pub, f), 'utf8').matchAll(/<loc>https:\/\/xtsy\.one([^<]*)<\/loc>/g)) urls.add(m[1] || '/');
}
const slim: Record<string, { t: string; d: string }> = JSON.parse(fs.readFileSync(path.join(pub, 'seo-slim-map.json'), 'utf8'));
const byPath = new Map<string, { t: string; d: string }>(STATIC_PAGE_DIRECTORY.map((p: any) => [p.path, { t: p.title, d: p.description }]));
for (const p of SIGNATURE_PACKAGES as any[]) byPath.set(`/tours/${p.slug}`, { t: p.title, d: `${p.duration} · ${p.region}` });
const toSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
for (const t of getAllTours()) byPath.set(`/tours/${toSlug(t.title)}`, { t: t.title, d: [t.duration, (t as any).location, t.description].filter(Boolean).join(' · ') });
for (const d of meghalayaDestinations) byPath.set(destinationPath(d.slug), { t: d.name, d: d.shortDescription });
for (const s of NE_STATES) {
  byPath.set(`/destinations/${s.slug}`, { t: `${s.name} travel guide`, d: s.blurb });
  for (const c of s.cities) byPath.set(`/destinations/${s.slug}/${c.slug}`, { t: `${c.name}, ${s.name}`, d: c.blurb });
}
const human = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const clean = (t: string) => t.replace(/\s*[|—–-]\s*XTSY.*$/i, '').trim();
const section = (u: string) => (/^\/stays|^\/book/.test(u) ? 'stays' : /^\/tours|^\/expeditions/.test(u) ? 'tours' : /^\/destinations|^\/places-to-visit/.test(u) ? 'locations' : /^\/tab-bistro/.test(u) ? 'experiences' : 'pages');

const out = [...urls].sort().map((u) => {
  const hit = byPath.get(u) ?? slim[u.replace(/\/$/, '').split('/').pop() ?? ''];
  return { u, t: clean(hit?.t ?? human(u.split('/').pop() || 'Home')), d: (hit?.d ?? '').slice(0, 160), s: section(u) };
});
fs.writeFileSync(path.join(pub, 'search-pages.json'), JSON.stringify(out));
const fallback = out.filter((o) => !byPath.has(o.u) && !slim[o.u.split('/').pop() ?? '']).length;
console.log(`search-pages.json: ${out.length} pages (${fallback} titled from their address), ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`);
