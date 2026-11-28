# Roadmap — Master SEO prompt (xtsy.one)

## Hostel-only access and campsite terms — 28 November 2026
- [ ] Confirm booking@xtsy.one account and verify hostel check-in uploads, policies, QR and staff downloads while blocking campsite access.
- [ ] Apply campsite rates and meal choices; remove all campsite live availability displays and restrictions.
- [ ] Record Sohra Bed & Breakfast as upcoming only, verify phone flows and save without publishing.

## Self check-in, invoicing and property naming — 28 November 2026
- [x] Rename the campsite to “Shnonpedeng Riverside Camping by XTSY” across guest content, console labels, metadata and generated discovery files without changing URLs or internal IDs.
- [x] Add per-property GST registration status so unregistered properties issue ordinary business invoices without GST, while registered properties retain tax invoices; keep XTSY and franchise records separate.
- [x] Build a guided mobile self check-in for both properties with guest/contact/stay details, separate identity-document front/back uploads, international-passport handling and explicit policy acceptance.
- [x] Add private staff-only check-in records and document downloads for admin@xtsy.one and booking@xtsy.one; rooms and beds remain desk-assigned.
- [x] Verify the complete international hostel flow and domestic campsite flow on a phone-sized screen with private uploads, guest view/download links, property-specific policies, no overflow and no browser errors; remove every test record afterwards. Guest payments remain off and nothing is published.
- [ ] Live staff sign-in verification waits for a confirmed booking@xtsy.one auth account; access rules, staff UI and document policies are implemented and tested, but no account was created automatically.

## Preview startup warnings — 24 November 2026
- [x] Removed unsupported Bluetooth header directives, duplicate homepage link keys and deprecated gallery motion usage; unused preview font preloads are now production-only. Recovered stale preview server markup; seven pages return 200 on phone/desktop with no browser warnings or errors. All 665 tests pass (four skipped). A harmless platform-managed path-resolution advisory remains in startup logs; guest policies and URLs unchanged, not published.

## Remaining tour and guide card photos — 24 November 2026
- [x] Checked main tour/destination lists, category guides, guide topics, nearby attractions and expedition cards. Existing main-list photos load; secondary cards lacked recovery or labelled regional photos as named attractions.
- [x] Reused gallery-selected photos with distinct regional backups on category/nearby cards; guide topics use relevant labelled property, Bistro, fleet or landscape photos and matching backups; expedition cards use photographer descriptions and geographic backups. All 132 main/topic/category/expedition photos verified on desktop and phone, plus forced cave/Bistro/nearby-image failure recovery. 665 tests pass (four skipped); preview build OK. No publishing, URL, price or booking changes.

## Selected trip-assistant security findings — 24 November 2026
- [x] Removed caller-controlled page context from model instructions; passed it only as untrusted user data. Regression test confirms malicious and normal page values produce identical system instructions; seven focused tests pass, preview build OK.
- [x] Disabled all paid guest answers, including direct requests to the retired endpoint. Guest chat stays local; dining, camping and rentals use shared website facts, other topics link to the public page index. Browser-verified five-day plans, lunch policy, merch discovery and direct off response; regression checks pass and preview build OK. Only the paid-access finding resolved; publishing not requested.

## Rental number-plate privacy — 24 November 2026
- [x] Blurred ten foreground/background plates across eight rental photos; remaining fleet images and the cover have no visible registration numbers. Original vehicles, scenery and attribution preserved.
- [x] Rebuilt 480/640/828/1280px WebP and AVIF variants from eight edited masters, saved to image storage and wired both formats into the shared catalogue. Both fleet tabs verified on desktop/phone; 663 tests pass (four skipped), preview build OK. Not published.

## Requested photo repairs — 23 November 2026
- [x] Removed the unrelated Merch photo band; the existing backpack illustration is now the cover, labelled Design preview.
- [x] Replaced the /tours hills cover with the reviewed Dawki river photo; guide cards use the shared authentic/regional selector, and photos retry their original source before a supplied fallback. Regional substitutes are visibly labelled.
- [x] Verified all cards on phone and desktop, the international tour filter, and a deliberately failed Mawsmai image recovering to a labelled landscape; six focused tests pass. Preview build OK. Fresh preview HTML still serves older server markup and causes hydration warnings while the current client renders the repaired pages; no unrelated server changes or publishing performed.

## Company, dining, database and tour-rate checks — 18 November 2026
- [x] Identified eight failing unit checks: stale canonical company-domain expectation, restaurant/SEO registry timeouts, generated database-helper existence checks, and obsolete seven-day tour-rate expectation.
- [x] Match checks to the approved canonical domains and ₹16,800 seven-day rate; keep generated backend files untouched while enforcing no application wiring.
- [x] All 284 unit checks pass (two environment-dependent checks skipped); company, both restaurant pages and seven-day tour return HTTP 200 with no browser errors or guest database requests. Removed the inaccurate Khasi-inspired claim from the restaurant route description and extended the dining guard to cover it. Approved prices, URLs, database state and consent tracking unchanged; build OK, not published.

## Sourced transport reference and outreach shortlist — 18 November 2026
- [x] Expanded the existing Guwahati–Shillong guide into a 1,566-word sourced Meghalaya arrival and road-planning reference; URL and XTSY catalogue prices unchanged. Unverified operator timetable/fare claims replaced by quote checks.
- [x] Delivered a 14-prospect public-source report plus four unresolved possibilities, with contacts, evidence, tailored angles and eligibility/fee uncertainty; no outreach sent. Final v2 report/CSV in Files, grouped with XTSY guest growth.
- [x] Seven tests passed; guide HTTP 200, ten internal links HTTP 200 without redirects, completed navigation to booking, four official sources, phone/desktop image and layout checked with no horizontal overflow or page errors; build OK. Saved without publishing.

## Review completeness and alignment — 18 November 2026
- [x] Centre the shared review showcase and platform scores across phone, tablet and desktop.
- [x] Retrieved all six Google hostel pages: 253 unique entries, 203 written reviews, 50 rating-only reviews and 236 replies. Owner-approved 252 headline unchanged; Bistro and OTA feeds remain separate.
- [x] Nine tests pass; phone/tablet/desktop show 253 hostel Google entries and 50 rating-only entries with no horizontal overflow. Build OK. Phone emitted an existing third-party Contentsquare duplicate-tag warning; tracking untouched. Saved without publishing.

## Platform review display — 18 November 2026
- [x] Show TAB Bistro's verified 4.7/34 Google rating and all 23 saved written Bistro reviews, alongside matching hostel food comments.
- [x] Add seven source-labelled hostel platform entries to shared review sections and stay hubs; Booking.com historical/unlisted, Goibibo owner-reported, Agoda verified 8.4/32 and Airbnb verified 5.0/3.
- [ ] MakeMyTrip score waits for owner confirmation of conflicting 4.1/5 versus 4.8/5; displayed as pending rather than invented.
- [x] Recovered five Agoda and all three hostel Airbnb comments from public listings; preserved original scales and low-rated feedback.
- [x] Five concrete score tests passed; review lists/filters checked on six pages at desktop and phone widths, no overflow or page errors. Preview clean. Publishing is not requested.

## Owner-approved date-change policy — 14 November 2026
- [x] Changed the shared guest policy and all three AI reference occurrences from 90 to 15 days. Existing 15-day pages, assistant answers, prices and other terms unchanged.
- [x] 27 tests passed; preview safety page renders 15 days, both AI reference files return HTTP 200 with 15 days and no former window; build OK. Prices unchanged; publish required.

## Trip assistant guest-first stays — 14 November 2026
- [x] Inventoried both policy windows, public pages, AI reference files, shared data, tests and 75 eligible generated guide entries; delivered the inventory without changing policies.
- [x] Stay answers and itinerary introductions lead with guest room/location needs; matching New Shillong rooms are optional, central/distant/accessibility requirements do not trigger a property offer. Prices and local-only execution preserved; fixed-base itineraries clearly remain proposals, not reservations.
- [x] 24 targeted tests pass; five stay questions verified in the browser and screenshot reviewed; build OK. Changes require publish. Owner subsequently selected 15 days; aligned above.

## Failing SEO findings — 14 November 2026
- [x] Fresh foundations scan: all nine HTTP, crawler, sitemap, page-basics and metadata checks pass.
- [x] Verified the stale hostel-rating finding against live homepage schema and owner-approved brandFacts: 4.7 from 252 reviews, not the obsolete 237 total; retained approved facts.
- [x] Transport guide: aligned search/social descriptions with the three transport options actually covered, removed the unsupported helicopter/current-fares preview claim, and added arrival-based comparison guidance without changing prices or URL. Preview HTTP 200 and updated content verified; 31 tests pass, static SEO checker zero errors, build OK. Both stored findings marked fixed awaiting scan verification; changes require publish.

## Production sitemap build failure — 14 November 2026
- [x] Historical GSC coverage validation now respects intentional service exclusions and still fails for missing indexable pages. Removed generation-date URL lastmod logic; the exact sitemap publishing sequence exits successfully (four intentional exclusions, zero missing pages), 16 targeted tests pass, SEO checker reports zero errors, and preview build is OK. Production deployment not requested in this turn.

## Service SEO coverage — 14 November 2026
- [x] Audited 538 programmatic guides: 91 outside owner service coverage are excluded from indexing/discovery; 69 previously advertised noindex/redirect URLs removed from sitemap branches. Page addresses preserved.
- [x] Khasi/traditional-food listings redirect to TAB Bistro before metadata; cuisine promotion removed from dining registry. Rental page, schema and AI reference files now use Assam/Meghalaya scope; general tours/expeditions remain unrestricted.
- [x] 67 targeted tests passed; SEO checker zero errors; eight browser routes verified. Retained indexable coverage: 12 Meghalaya group guides, 11 Meghalaya honeymoon guides, 20 local hostel guides, 66 local dining guides, six rental guides; changes require publishing and search recrawl. No new international offers invented.

## Photos and company corrections — 14 November 2026
- [x] Shared photo selectors now cover all 43 destinations and every tour: 29 missing destination photos use truthfully labelled Meghalaya regional landscapes; eight empty tour cards use reviewed regional Pexels photos. Corrected car-versus-bike and Seven Sisters image selection. All 88 selected photo URLs returned actual images.
- [x] Removed inactive entity GST references from public source and updated company facts, About, contact, guide copy, Organization schema and AI reference files: Coimbatore, incorporated 29 September 2026, franchise/SaaS scope and both core domains. Approved prices and tax calculations untouched.
- [x] Six pages checked on desktop/phone: photos render, company facts present, no overflow or page errors. 47 targeted tests passed; build OK. Individual landmark photography remains unavailable for the 29 regional substitutes; no generated or misleading landmark images used. Changes require publish.

## Ahrefs audit — 14 November 2026
- [x] Verified all 706 exported page entries in preview: all return 200, with descriptions 110–160 characters and no visible template codes.
- [x] Corrected the 44 schema-domain defects, placeholder/relative schema images, missing sitemap coverage and hidden-page regeneration. Photographer profile URLs normalised with trailing slashes; external readback blocked by Pexels, so redirect resolution remains unverified.
- [x] 207 tests passed, 4 skipped; static SEO checker clean, build OK. Five pages verified on desktop/phone with no overflow or browser errors; guide-to-tour navigation and Quick facts checked.
- [x] Remaining: hosting-level HTTP/www redirect chain and crawl-time performance require hosting evidence; image-sitemap overlap is intentional. Optional Article/Product/ItemList notices are not blanket schema requirements. Google title rewrites cannot be forced. Kynrem photo missing and Bistro cuisine copy needs owner factual review; neither changed speculatively. Publish required; audit recount pending a new crawl.

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

## Install and gallery pages removed — 18 November 2026
- [x] Deleted /install and /gallery routes and pages per owner request; removed all header, footer, SafeShell, 404, search-index, llms.txt and script references. Both URLs now return 404; build OK. The http://www redirect chain is a Cloudflare-side matter — no code change, owner accepts the Ahrefs notice.
