# Super admin console for the booking engine (PMS + POS)

## What you get
A private console at `/admin`, signed in only as **admin@xtsy.one**. From it you control the hotel booking engine for **XTSY Travellers Hostel** and **Experience by XTSY**, and the restaurant side for **TAB Bistro by XTSY** at `/admin/restaurants`.

```text
Guest site (xtsy.one)  <->  PMS by XTSY (posbyxtsy.club)  <->  Channel manager (OTAs)
        ^                            ^
   Super admin console --------------+   (console talks to the PMS; the PMS talks to OTAs)
TAB Bistro pages  <->  POS by XTSY (posbyxtsy.club)  <-  /admin/restaurants
```

### Console pages
1. **Overview** – connection status for the PMS and POS (connected / off / error), when they last synced, and today's occupancy and requests.
2. **Stays – Rooms and availability** – a calendar for each property and room type, showing free beds or rooms, nightly rate and open/blocked state.
   - Block or open dates, with a reason (maintenance, private event).
   - Sync rooms now: re-reads inventory and rates from the PMS.
   - Check availability for any dates and number of guests, the same check guests get.
3. **Stays – Enquiries/bookings** – incoming stay requests from the site, with status (new, held, confirmed, cancelled) and their PMS reference.
4. **Restaurants (`/admin/restaurants`)** – TAB Bistro tables:
   - A live table board showing free and booked slots for any date.
   - Open or close slots and turn the "live tables" showcase on the Bistro page on or off.
   - Table and lunch-preorder requests, with their POS reference.
5. **Integration settings** – an on/off switch for the PMS and POS connections, plus a test-connection button. The access key itself is stored as a secret, never shown.

### Guest-site changes
- The booking page and Bistro page show live availability and tables **only when** you switch the matching connection on. Until then, they keep today's static rooms and the WhatsApp enquiry flow.
- Prices always come from the PMS when it's connected, and otherwise from today's approved prices. Nothing gets repriced on the site.

## Things to know before approving
- **Sign-in and the backend come back.** You switched the backend off and removed all sign-in earlier. The console needs both, so I'll resume the backend for admin sign-in and the console's own records (audit log, blocks waiting to sync). Guest pages still won't read the backend.
- **Real room data lives in the PMS.** Until posbyxtsy.club has the endpoints from the API spec, the console works with your current static rooms and marks every change as "waiting for PMS". Nothing is lost when it connects.
- **No direct OTA writes from the website.** Channel-manager pushes happen inside the PMS, as your rules require; the console only sends changes to the PMS.
- **No background jobs.** "Sync" happens when you press it or open a page, never on a timer. That matches your no-recurring-work rule.

## Technical details
- Auth: email/password sign-in via the backend; a `user_roles` table with a `super_admin` role, granted only to the verified `admin@xtsy.one` account through a migration/trigger; `has_role()` checks; console routes under `_authenticated` plus a role gate; all console server functions use `requireSupabaseAuth` and a server-side role check.
- Tables: `admin_audit_log`, `inventory_overrides` (property, unit, date range, open/blocked, pms_status), `integration_settings` (pms_enabled, pos_enabled, live_tables_showcase). All admin-only via RLS, no anon access.
- Integration: extend `src/integrations/xtsy-saas` with block/open, sync and status calls (new endpoints added to the API spec as `_v2`). Writes are queued as "pending" when the connection is off.
- Guest pages keep using static data unless the flag is on; the flag is read through a public server function, so guest code still never queries the database directly.
- Tests: only admin@xtsy.one gets the role; blocked dates cannot be booked; prices unchanged.
