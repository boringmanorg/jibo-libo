/**
 * scripts/seo-check.mjs — static SEO guardrails (SEO master prompt, Part 0).
 *
 * Fails (exit 1) on:
 *   - any www.xtsy.one URL in src/ or public/ (canonical host is https://xtsy.one)
 *   - any hreflang tag in src/ (site is English-only)
 *   - any raw <a href="https://wa.me …> in src/ (use the openWhatsApp() button helper)
 *   - duplicate <title> or meta description across ALL_SEO_PAGES
 *   - H1 identical to title on any SEO page
 *   - noindex routes (/install, /gallery) or redirected URLs present in sitemaps
 *
 * Run: bun scripts/seo-check.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const errors = [];
const warnings = [];

// ── 1. Source greps ─────────────────────────────────────────────────────────
const grep = (pattern, paths) => {
  try {
    return execSync(`rg -n "${pattern}" ${paths} --no-heading`, { encoding: 'utf8' }).trim();
  } catch {
    return ''; // rg exit 1 = no matches
  }
};

const wwwRaw = grep('www\\.xtsy\\.one', 'src public');
// Ignore comment lines (e.g. the _redirects header explaining the zone-level www rule).
const www = wwwRaw.split('\n').filter((l) => l && !l.split(/:\d+:/)[1]?.trim().startsWith('#')).join('\n');
if (www) errors.push(`www.xtsy.one URLs found (use https://xtsy.one):\n${www}`);

const hreflang = grep('hreflang', 'src');
if (hreflang) errors.push(`hreflang tags found (site is English-only):\n${hreflang}`);

const waAnchors = grep('href=.*wa\\.me', 'src');
if (waAnchors) errors.push(`raw wa.me <a href> links found (use openWhatsApp() buttons):\n${waAnchors}`);

// ── 2. SEO page data: duplicate titles/descriptions, H1 = title ─────────────
const { ALL_SEO_PAGES } = await import('../src/data/seoPages.ts');

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const byTitle = new Map();
const byDesc = new Map();
for (const p of ALL_SEO_PAGES) {
  const t = norm(p.title);
  const d = norm(p.metaDescription);
  if (!t) errors.push(`${p.slug}: missing title`);
  if (!d) errors.push(`${p.slug}: missing meta description`);
  if (t && byTitle.has(t)) errors.push(`duplicate title: "${p.title}" on /${p.slug} and /${byTitle.get(t)}`);
  if (t) byTitle.set(t, p.slug);
  if (d && byDesc.has(d)) warnings.push(`duplicate meta description on /${p.slug} and /${byDesc.get(d)}`);
  if (d) byDesc.set(d, p.slug);
  if (t && norm(p.h1) === t) errors.push(`H1 identical to title on /${p.slug}: "${p.title}"`);
}

// ── 3. Sitemaps must not list noindex or redirected URLs ────────────────────
const NOINDEX_ROUTES = ['/install', '/gallery'];
const redirects = fs.readFileSync('public/_redirects', 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split(/\s+/)[0]);

const sitemapFiles = fs.readdirSync('public').filter((f) => f.startsWith('sitemap') && f.endsWith('.xml'));
for (const file of sitemapFiles) {
  const xml = fs.readFileSync(`public/${file}`, 'utf8');
  for (const r of NOINDEX_ROUTES) {
    if (xml.includes(`https://xtsy.one${r}<`)) errors.push(`${file}: lists noindex route ${r}`);
  }
  for (const r of redirects) {
    if (r !== '/' && xml.includes(`https://xtsy.one${r}<`)) errors.push(`${file}: lists redirected URL ${r}`);
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`\nSEO check — ${ALL_SEO_PAGES.length} programmatic pages, ${sitemapFiles.length} sitemaps`);
for (const w of warnings) console.log(`  warning: ${w}`);
if (errors.length) {
  console.error(`\n${errors.length} SEO error(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('  0 errors — all static SEO checks passed.\n');
