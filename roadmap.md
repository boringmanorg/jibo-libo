# Roadmap — Master SEO prompt (xtsy.one)

Approved scope: **Part 0 + Part 7 quick wins (7a, 7b, 7c, 7d, 7f)** first, then continue part by part.

## Owner decisions (this session)
- /xtsy-270: new URL `/romantic-glass-glamping/stay-in-meghalaya/shillong`, branded "Experience by XTSY — India's First Stargaze Glass Glamping", with stargaze weather cautions. (Part 3a, later)
- Saturday tour REVIVED with new terms: 1st & 3rd Saturday every month (all months), 4N/5D only, min 4 per group, ₹2,800/night/person, ₹10,000/person total for 4N; stay+transport+breakfast included; 3N XTSY Hostel + 1N XTSY Dawki (Shnongpdeng) Riverside Camping (breakfast, dinner, bonfire at both). Focus on current + upcoming week. (Part 2b, later)
- "youth hostel shillong" stays EXCLUDED.
- Stargazing never guaranteed; StargazingAckGate modal before WhatsApp CTAs on stargazing pages (rule 6a).

## Part 0 — zero Semrush audit errors/warnings
- [x] E1: hreflang — source is clean (nothing emits hreflang); stale tags live in the Cloudflare KV prerender cache → purge/re-prerender on next deploy (owner action)
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
- [ ] Current approval: inspect existing Cloudflare Worker deployment and regenerate the KV page cache once; no recurring jobs.
- [ ] Current approval: select 30 leading pages from live search data and add visible, content-matched question answers.
- [x] 7a: robots.txt already allows AI crawlers; removed worker 403 on GPTBot/ClaudeBot/etc. — NEEDS WORKER REDEPLOY (owner action)
- [x] 7b: llms.txt + llms-full.txt — corrected Bistro hours, added stargazing caution + facts page
- [x] 7c: answer-first blocks verified rendering (data-quick-answer) on programmatic pages
- [x] 7d: NEW /about/xtsy-facts + Organization/Breadcrumb JSON-LD, linked from /about, sitemap, llms.txt
- [ ] 7f: PAA/AI-Overview blocks on top ~30 ranking pages (quickAnswer exists; full pass pending)

## Verification (12 Nov 2026)
- build OK; 177/177 unit tests pass (2 Playwright spec files fail to load under vitest — pre-existing config issue, unrelated)
- /about/xtsy-facts returns 200; seo-check 0 errors
- Placeholder to fill: {{FOUNDED_DATE}} on /about/xtsy-facts

## Later parts (not yet approved for this run)
- Part 1: prerendering/SSG, redirects map, lost pages, prune thin pages, seo-inventory.csv
- Part 2: /hostel-in-shillong, /meghalaya-tour-packages (Saturday tour per owner terms), rentals
- Part 3: couples segment incl. /xtsy-270 move per owner decision
- Parts 4–6, 7e, 7g–7j
