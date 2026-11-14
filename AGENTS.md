# Architecture rules

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
- Keep the selected ranking-page answers in a browser-safe editorial module and render them visibly through the shared page shell; reuse those answers in existing guide schema so visible and structured answers cannot drift.
- Directory labels use complete current page titles; static-route titles take precedence over colliding catalogue entries, and redirects/private routes stay out of the public directory to avoid misleading or broken discovery links.
- Saturday group tour terms and departure dates come only from the browser-safe saturdayGroupTour data module; this keeps the tour page and destination CTAs consistent.
- Keep page dates on Article/WebPage entities, coordinates on Place entities and schema images absolute and placeholder-free; schema.org domains must match the entity being described.
- Sitemap pruning must exclude all intentionally noindex guest utilities and prefer active catalogue pages over stale recovery aliases, matching route resolution; regenerated lists must not hide live guides or reintroduce hidden pages.
- Reuse company identity from brandFacts for visible facts and Organization schema, keeping corporate headquarters separate from guest-property addresses.
- Missing landmark photos may use reviewed regional landscapes with truthful regional alt text; never relabel another landmark or generate a documentary travel photo.
