# Roadmap — Master SEO prompt (xtsy.one)

Approved scope: **Part 0 + Part 7 quick wins (7a, 7b, 7c, 7d, 7f)** first, then continue part by part.

## Owner decisions (this session)
- /xtsy-270: new URL `/romantic-glass-glamping/stay-in-meghalaya/shillong`, branded "Experience by XTSY — India's First Stargaze Glass Glamping", with stargaze weather cautions. (Part 3a, later)
- Saturday tour REVIVED with new terms: 1st & 3rd Saturday every month (all months), 4N/5D only, min 4 per group, ₹2,800/night/person, ₹10,000/person total for 4N; stay+transport+breakfast included; 3N XTSY Hostel + 1N XTSY Dawki (Shnongpdeng) Riverside Camping (breakfast, dinner, bonfire at both). Focus on current + upcoming week. (Part 2b, later)
- "youth hostel shillong" stays EXCLUDED.
- Stargazing never guaranteed; StargazingAckGate modal before WhatsApp CTAs on stargazing pages (rule 6a).

## Part 0 — zero Semrush audit errors/warnings
- [ ] E1: prior cache diagnosis disproved by live Cloudflare inventory on 12 Nov: the active site has only an ASSETS binding, and the alleged prerender namespace contains no HTML pages. Root head still emits homepage hreflang; a separate targeted hreflang correction remains pending.
- [x] E2: JSON-LD — /xtsy-270 LodgingBusiness offers→makesOffer; tour provider→Organization {name:XTSY, url}; removed "Stargazing" amenity claim (rule 6a)
- [x] E3: /best-restaurant-in-shillong + /best-restaurant-shillong removed → 301 /best-restaurants-shillong (edge _redirects, sitemaps, internal links)
- [x] W1: all 11 raw wa.me anchors → buttons via shared openWhatsApp() helper
- [x] W3: H1≠title on nongjrong-tour-package, party-catering-shillong, hostel-in-shillong-this-weekend, meghalaya-trip-today, sacred-temples tour
- [x] W4: /install + /gallery noindex,follow; /gallery out of sitemap
- [~] W5: /__l5e/events.js is platform-served — cache headers not settable from repo (noted to owner)
- [x] www: repo clean; zone-level 301 already in place (Cloudflare Single Redirect)
- [x] Notices: /tab-bistro/catering links → /catering-shillong (10 files); /book noindex (already) + out of sitemap + Disallow: /book in robots.txt
- [x] scripts/seo-check.mjs — 0 errors (538 pages, 12 sitemaps)

## Part 7 quick wins
- [x] Current approval: inspected existing Cloudflare deployment and cache. No page cache exists to regenerate (only two configuration-named keys); no deletion or traffic changes performed. Live site is an asset-hosting Worker, which cannot be redeployed through Lovable's Cloudflare connector.
- [x] Current approval: selected exactly 30 leading pages by Google clicks (12 Oct–9 Nov) and added visible, content-matched answers.
- [ ] 7a: source crawler block removed, but edge-seo Worker is only on the probe path; production is a different asset-hosting Worker. Its app redeployment is unsupported here; use Lovable Publish for the app, not replacement Worker infrastructure.
- [x] 7b: llms.txt + llms-full.txt — corrected Bistro hours, added stargazing caution + facts page
- [x] 7c: answer-first blocks verified rendering (data-quick-answer) on programmatic pages
- [x] 7d: NEW /about/xtsy-facts + Organization/Breadcrumb JSON-LD, linked from /about, sitemap, llms.txt
- [x] 7f: all 30 selected pages return 200 and show 3–4 always-visible editorial questions; no Google PAA placement or AI citation guarantee. Existing guide FAQ schema reuses the same answers; duplicate visible accordion sections suppressed on selected pages.

## Verification (12 Nov 2026)
- [x] Current request: refreshed /guides with 541 full-title entries, search and topic filtering; 488 original directory URLs and 689 sitemap URLs checked in preview with zero terminal HTTP errors, 14 sitemap redirects documented; delivered architecture report and URL CSV. Editor URL picker is platform-owned and unchanged. New directory requires publish.
- Current run: 78 targeted tests passed; all 30 pages checked in the browser, desktop/phone answer screenshots reviewed, phone document has no horizontal overflow; build OK.
- build OK; 177/177 unit tests pass (2 Playwright spec files fail to load under vitest — pre-existing config issue, unrelated)
- /about/xtsy-facts returns 200; seo-check 0 errors
- Placeholder to fill: {{FOUNDED_DATE}} on /about/xtsy-facts

## Later parts (not yet approved for this run)
- Part 1: prerendering/SSG, redirects map, lost pages, prune thin pages, seo-inventory.csv
- Part 2: /hostel-in-shillong, /meghalaya-tour-packages (Saturday tour per owner terms), rentals
- Part 3: couples segment incl. /xtsy-270 move per owner decision
- Parts 4–6, 7e, 7g–7j

## SEO audit brief (12 Nov 2026) — open
- [x] Task 1 audit errors (hreflang, schema, wa.me buttons, canonical, robots /book kept blocked)
- [x] Task 2 inventory: seo-inventory.csv — awaiting owner approval before any 301/noindex
- [x] Rename glass suite copy to "Experience by XTSY: The Romantic Couple Stay in India is now at New Shillong, Meghalaya" → /experience-by-xtsy, /xtsy-270 301
- [~] Task 3 answer blocks (In short + Quick facts + Stay & tour on 20 destination guides; owner fills placeholders)/quick facts on 30 pages (placeholders allowed; tour terms 4N/5D ₹10,000)
- [x] Task 4: /hostel-in-shillong dropped (duplicate); /meghalaya-tour-packages features Saturday tour
- [ ] Task 5 copy expansion needs owner-verified facts: waterfall expansions + Mawsynram/Nartiang/Balpakram
