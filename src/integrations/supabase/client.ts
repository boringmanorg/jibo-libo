/**
 * The site has no database dependency.
 *
 * xtsy.one runs entirely on static data and WhatsApp hand-off: room rates come from
 * src/config/roomTypes.ts, enquiry references are generated in the browser
 * (src/lib/localEnquiry.ts), and reviews are served from src/data/featuredGoogleReviews.ts.
 * Nothing on the site reads or writes a backend.
 *
 * This module used to create a real Supabase client. It now re-exports the inert
 * stand-in so that any remaining import resolves without a network request. Keeping
 * the module (rather than deleting it) means no caller has to change, and no code
 * path can accidentally reach a paused or unfunded backend.
 *
 * Every call resolves to { data: null, error: null, count: null }. That is safe for
 * fire-and-forget telemetry. It is NOT safe for a write a guest is told succeeded:
 * `error` is always null, so `if (error)` never fires and the caller would report
 * success having saved nothing. Any such path must hand off to WhatsApp instead --
 * see src/services/cateringService.ts for the pattern.
 */
export { offlineBackend as supabase } from '@/lib/offlineBackend';
