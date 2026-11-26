# Google Sheet → xtsy.one availability

The owner keeps live availability in the **Room Management** tab of the "Room Management" Google Sheet.
`availability-sync.gs` runs inside that sheet and sends the date-wise free counts to the website, which
then shows them on /book (console blocks are taken off on top).

Only room numbers, dates and counts are sent. Guest names and notes never leave the sheet.

**One tab.** The script works only on the **Room Management** tab (never Tours, Rates or Raw Data).
`@OnlyCurrentDoc` limits Google's permission to this one file.

## Bookings written into the sheet (agreed with the owner, 26 Nov 2026)

OTA bookings (arriving through ZimmerStack) and xtsy.one bookings are written into Room Management the
way the owner writes them by hand, so the owner types **only offline bookings**:

- **Which room:** the lowest-numbered room of that type with space for the whole group on every night
  (6-bed mixed: 4, then 5, then 7). Only if no single room fits is the group split across rooms, in
  number order, keeping the same rooms every night.
- **What it writes:** that night's count goes down by the beds or rooms taken, and the note cell (the date
  column) gets `Priyanka Sharma 2B MMT` for dorms (**B** = beds) or `Rahul Das 2G AGODA` for private rooms
  (**G** = guests). xtsy.one bookings are tagged `XTSY`; OTAs `MMT`, `GOIBIBO`, `BDC`, `AGODA`, `HW`,
  `AIRBNB`, `EXPEDIA`, `TRIP`, `YATRA`. An existing note is kept: `Rama Krishna 1B + Priyanka Sharma 2B MMT`.
- **Cancelled or changed:** the same cells get their beds back and the note becomes
  `Priyanka Sharma 2B MMT (cancelled)`; a changed booking is then written again.
- **Never below 0:** if a night cannot fit everyone, the extra is written with `OVERBOOKED` and shows in
  the console Inbox under **Google Sheet needs you**. A month that is not in the sheet yet is not written
  at all (also shown there) and is tried again once the month is added. A count cell holding a formula is
  left alone (only the note is added) and reported.
- **Only the count and note cells** of the booked nights change; nothing else in the tab is touched.
- **When:** within a minute of the booking (the one-minute run), or at once on any edit or
  **XTSY → Sync with xtsy.one now**. Until the sheet has it, /book holds those rooms, so nothing is offered
  twice in between; once written, the sheet alone counts it. Each booking is written once: the script
  remembers what it wrote until the website confirms it.
- Write-back starts the first time the updated script runs. Bookings that arrived before that stay as
  they were (the old rule: held on /book until you edit that night).

**Updating from the read-only script:** paste the new `availability-sync.gs` over `Code.gs` and save.
No new pairing is needed; Google may ask you to allow it again the first time it writes (same one-file
permission).

## One-time setup (no password)

1. **Website:** merge and publish. Nothing to configure.
2. **Sheet:** Extensions → Apps Script → replace everything in `Code.gs` with `availability-sync.gs` → Save.
   Reload the sheet; an **XTSY** menu appears.
3. **XTSY → Connect to xtsy.one (once).** Google asks for permission the first time. The sheet shows a
   pairing code such as `4831-2297`.
4. **Console → Stays → Availability from your Google Sheet:** the same code appears there. Check it
   matches and press **Approve** (within 30 minutes). Anyone else's request can be rejected there.
5. **XTSY → Set up automatic sync (once, after approval).** From then on every saved edit syncs straight
   away, structural changes (rows, columns, a new month) sync too, and a one-minute backup run catches
   anything missed.

**How outsiders are kept out:** the website accepts numbers only from a sheet whose pairing code a console
admin approved. The sheet's token is random (256-bit) and only its SHA-256 hash is stored; Disconnect in
the console revokes it instantly. Pairing requests are limited to 5 an hour per visitor and 10 pending in
total, and expire after 30 minutes. Only JSON under 1 MB is read; an empty send is never published.

**When guests see a change:** each sync is published as soon as it arrives and every open booking page
refreshes at once; new and returning visitors always load the latest published counts. So a change
saved at 10:00:20 shows for everyone a few seconds later. The console shows the same counts.

## How the sheet is read

- A month block starts with a label in column A such as `December 2026` (a label without a full year,
  like `February ` or `July 26`, is skipped).
- The next row has dates as `MM/DD`. The cell **left of each date** is that date's free count; the date
  column itself is the guest note and is ignored.
- Each room row has the room name in column A and the room number in column B. Room numbers map to
  the website's room types in `src/booking/sheetAvailability.ts` (9, 10 → 4-bed female; 4, 5, 7 →
  6-bed mixed; 2, 3 → 6-bed standard; 8 → 8-bed; 1, 6 → King; 11 → Triple; 666 → Experience by XTSY).
  A new room number is reported back as `unknownRooms` until it is added there.
- Every night from today to the end of the **last month in the sheet** is sent; add "March 2027" and it
  appears on the website on the next save. Each sync replaces the previous one, so a changed or removed
  number changes on the website too.
- Once the sheet has synced, it is the only source: nights after its last month (or a blank count cell)
  are not bookable on the website. Console blocks are still taken off on top.
- /book refreshes the moment a sync, a console block or an OTA booking lands (data-free signal), and
  again whenever a guest returns to the tab or comes back with the back button. /book is never stored
  by a browser or CDN (`no-store`), so a returning visitor always loads today's counts.
