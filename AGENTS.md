# Architecture rules

- Keep the transport reference's sources, review date and FAQ answers in one browser-safe module shared by visible content and route-owned schema; do not present static guidance as live road, fare or timetable data.

- Read hosted-guest displays from the static brandFacts guest total; a single owner-updated value prevents counters and editorial references from drifting.
- Derive the homepage tour count from both /tours card catalogues via tourCatalogueStats, saved in tourCatalogueCount with a test guarding drift, so the homepage never loads the catalogues; homepage review cards likewise come from the generated homeFeaturedReviews and the full feed loads on demand.

- Keep platform review snapshots in browser-safe data, preserve each original rating scale and listing identity, and label historical/unconfirmed scores; shared review displays must not imply current OTA availability or blend selected-review averages.
- Use the complete ID-deduplicated Google hostel snapshot in shared review lists, including rating-only entries; legacy excerpts must not duplicate the same listing feed.

- Apply the shared browser-safe service coverage policy to guide robots, directory links, related links and sitemap generation; preserve out-of-scope addresses with noindex and redirect excluded cuisine listings before metadata.

- Retired tour offers must leave the shared catalogue and sitemap and redirect before metadata loading; this prevents stale offer schemas and indexed duplicate pages.

- Resolve booking catalogue labels and calculate GST-inclusive quotes through the shared booking quote utilities; this keeps displayed, persisted and WhatsApp amounts consistent without bypassing server validation.
- Keep shared hostel policies in a browser-safe data module and reuse them in guest information pages; this prevents policy copy from drifting between pages.
- Extend the existing `/faq` page rather than creating a duplicate hostel FAQ URL; public safety rules have their own route and route-owned metadata.
- Load optional consent diagnostics after mount with a locally caught import failure; a missing debug chunk must never reject into the root route and hide guest content.
- Use the shared consent parser and pre-tag Consent Mode bootstrap for analytics permission; this prevents loaders and identifier writers from restoring incompatible or forced-opt-in records.
- Store table, campsite and contact requests through the shared enquiry function with a distinguishing type instead of adding a parallel reservations table or route; this keeps one pending queue for the desk and preserves its server-side validation and throttling.
- Store Bistro lunch preorders in the existing table-request enquiry category, distinguishing lunch in the request name and details; requested lunch times never extend the restaurant's table service windows.
- Redirect saved Bistro requests to WhatsApp in the current tab; opening a new tab after the asynchronous save can be blocked by browsers.
- Keep destination-specific planning links in the destination record and let TanStack own that destination's metadata; this avoids generic duplicate links and competing page-level tags.
- Keep SECURITY DEFINER functions that call `auth.*` owned by a role with USAGE on the `auth` schema; ownership repairs must retain caller-bound admin checks, backend-only OTP execution and narrowly scoped write grants, because the migration role cannot access auth and an ownership handover must not expose privileged operations.
- Reconcile TAB Bistro's Google hours and lunch wording only from shared site policy constants through a secret-authenticated published callback; use one hourly backend job, a database lease, validate-before-write and readback, never visitor-triggered writes or preview scheduling, to preserve listing scope and prevent concurrent updates.
- Enforce external conversion eligibility in the browser-safe shared conversion policy and route traffic-service emissions through dataLayerService; this keeps admin diagnostics independent while preventing unvalidated or low-intent signals from reaching GTM.

- Guest-facing code must not call the database; data access goes through `@/lib/offlineBackend` and content comes from static data modules, so the Cloud database can stay paused without breaking the site.
- Check database cutoff by rejecting application imports of generated database server helpers, not their existence; platform-owned files may regenerate and must remain untouched and unwired.
- Run unit checks through the dedicated Vitest configuration with bounded workers; Playwright browser specs use their own runner to avoid collection errors and SEO-registry transform contention.
- Keep the selected ranking-page answers in a browser-safe editorial module and render them visibly through the shared page shell; reuse those answers in existing guide schema so visible and structured answers cannot drift.
- Directory labels use complete current page titles; static-route titles take precedence over colliding catalogue entries, and redirects/private routes stay out of the public directory to avoid misleading or broken discovery links.
- Saturday group tour terms and departure dates come only from the browser-safe saturdayGroupTour data module; this keeps the tour page and destination CTAs consistent.
- Keep page dates on Article/WebPage entities, coordinates on Place entities and schema images absolute and placeholder-free; schema.org domains must match the entity being described.
- Sitemap pruning must exclude all intentionally noindex guest utilities and prefer active catalogue pages over stale recovery aliases, matching route resolution; regenerated lists must not hide live guides or reintroduce hidden pages.
- Historical sitemap recovery checks must apply the shared indexing policy and still fail for missing indexable pages; omit generation-date URL lastmod values because they are not content-change timestamps.
- Reuse company identity from brandFacts for visible facts and Organization schema, keeping corporate headquarters separate from guest-property addresses.
- Missing landmark photos may use reviewed regional landscapes with truthful regional alt text; never relabel another landmark or generate a documentary travel photo.
- Destination cards, category guides and nearby cards share the gallery selector and labelled travel-photo wrapper; topic and expedition cards also supply distinct geographic backups so missing optimised photos cannot leave blank cards or mislabel regional scenes as attractions.
- Route stay questions and itinerary introductions through the browser-safe guest-needs recommendation helper; offer the property only for matching room and location needs, and label fixed-base itineraries as proposals so advice does not imply a confirmed stay.
- Keep suite photo-strip keyframes global and parameterise geometry with CSS variables; preserve spaced static tile transforms when motion is disabled so preview and accessibility settings cannot stack the photos.
- Use a single translated photo track at tablet widths instead of cylindrical projection; shared movement preserves constant gaps and full photo framing through resizing and reduced-motion settings.
- Prerender only visitor-identical public pages listed explicitly in vite.config.ts with auto-discovery off; the router keeps trailingSlash "preserve" because the prerenderer requests "/page/" and would otherwise loop on redirects.
- Route head()/loader helpers must not import the programmatic guide library; route options are bundled into the main script on every page.

- Group route files in pathless folders `(stays)`, `(tours)`, `(restaurant)`, `(guides)`, `(company)`, `(admin)`; moved pages live under real `/stays`, `/tours`, `/tab-bistro`, `/guides` and `/about` folders (no new top-level page files; programmatic guides render at `/guides/$slug` via `guidePath`, and old top-level guide slugs 301 in `src/server.ts`), and old addresses are not route files: they 301 in `src/server.ts` from `src/data/legacyRedirects.ts` (moves in `movedPages.ts`, which sitemaps and the guide directory exclude), keeping the editor page list to real pages.
- Connect stays to PMS by XTSY and restaurant tables/QR to POS by XTSY (posbyxtsy.club) only through `src/integrations/xtsy-saas`; the server client stays off unless XTSY_SAAS_ENABLED is "true", so the static catalogue and WhatsApp enquiry flow remain the default and nothing is forwarded by accident.
- Live availability refreshes on a data-free Realtime broadcast ('sheet-availability') fired by a trigger when a sheet sync lands, never on timers; use the dedicated session-free notification client, not the inert offline client, and catch up on subscription/reconnection. Every guest page listens through the root layout (lazily) and refetches through its existing loaders; console pages refresh their own queries; console blocks ring the same signal.
- Wrap lazy imports of browser-only notification modules in createClientOnlyFn; useEffect alone does not remove their imports from the SSR build graph.
- Rental plate edits are baked into master pixels before rebuilding every WebP/AVIF size; CDN variants use explicit format URLs so no browser fallback can expose an unredacted thumbnail.

- Keep guest chat entirely local, using canonical browser-safe facts and the public search index for page discovery; retain the retired paid endpoint as an unconditional off response so direct requests cannot spend credits.
