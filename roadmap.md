# Roadmap — Master SEO prompt (xtsy.one)

Approved scope: **Part 0 + Part 7 quick wins (7a, 7b, 7c, 7d, 7f)** first, then continue part by part.

## Owner decisions (this session)
- /xtsy-270: new URL `/romantic-glass-glamping/stay-in-meghalaya/shillong`, branded "Experience by XTSY — India's First Stargaze Glass Glamping", with stargaze weather cautions. (Part 3a, later)
- Saturday tour REVIVED with new terms: 1st & 3rd Saturday every month (all months), 4N/5D only, min 4 per group, ₹2,800/night/person, ₹10,000/person total for 4N; stay+transport+breakfast included; 3N XTSY Hostel + 1N XTSY Dawki (Shnongpdeng) Riverside Camping (breakfast, dinner, bonfire at both). Focus on current + upcoming week. (Part 2b, later)
- "youth hostel shillong" stays EXCLUDED.
- Stargazing never guaranteed; StargazingAckGate modal before WhatsApp CTAs on stargazing pages (rule 6a).

## Part 0 — zero Semrush audit errors/warnings
- [ ] E1: remove all hreflang tags (site is English-only; keep lang="en-IN")
- [ ] E2: fix JSON-LD builders (LodgingBusiness makesOffer, TouristTrip provider as Organization, one @graph per page)
- [ ] E3: /best-restaurant-in-shillong + /best-restaurant-shillong → 301 /best-restaurants-shillong
- [ ] W1: wa.me <a href> → <button> + shared openWhatsApp(text) helper (keep tel: in footer)
- [ ] W3: fix H1 = title on 10 pages
- [ ] W4: /install + /gallery → noindex,follow, out of sitemaps
- [ ] W5: /__l5e/events.js cache headers (report if not controllable from repo)
- [ ] www→non-www: replace www.xtsy.one everywhere; 301 redirect (report if hosting-level)
- [ ] Notices: internal links to redirected URLs; /book noindex + out of sitemap
- [ ] scripts/seo-check.mjs build check (titles, H1, hreflang, www, wa.me links, canonical, JSON-LD, word count, sitemap)

## Part 7 quick wins
- [ ] 7a: robots.txt — explicitly allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.), keep Disallow /book
- [ ] 7b: rewrite /llms.txt + generate /llms-full.txt
- [ ] 7c: answer-first format components ("In short" block, Quick facts table, PAA-style H2/H3, last-updated byline)
- [ ] 7d: NEW /about/xtsy-facts entity page + Organization JSON-LD
- [ ] 7f: PAA/AI-Overview blocks on top ~30 ranking pages

## Later parts (not yet approved for this run)
- Part 1: prerendering/SSG, redirects map, lost pages, prune thin pages, seo-inventory.csv
- Part 2: /hostel-in-shillong, /meghalaya-tour-packages (Saturday tour per owner terms), rentals
- Part 3: couples segment incl. /xtsy-270 move per owner decision
- Parts 4–6, 7e, 7g–7j
