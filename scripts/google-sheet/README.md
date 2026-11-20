# Google Sheet → xtsy.one availability

The owner keeps live availability in the **Room Management** tab of the "Room Management" Google Sheet.
`availability-sync.gs` runs inside that sheet and sends the date-wise free counts to the website, which
then shows them on /book (console blocks are taken off on top).

Only room numbers, dates and counts are sent. Guest names and notes never leave the sheet.

**Read-only, one tab.** The script reads only the **Room Management** tab (never Tours, Rates or Raw Data)
and never writes anything to the spreadsheet. `@OnlyCurrentDoc` limits Google's permission to this file.
When a channel manager or PMS is connected later, any rule for writing back to the sheet will be agreed
with the owner first; this script has none.

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

**When guests see a change:** each sync is published as the next minute's snapshot. At the start of that
minute every open booking page refreshes together; new and returning visitors always load the last
published snapshot. So a change saved at 10:00:20 shows for everyone from about 10:01.

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
- /book refreshes just after each minute boundary while open (and when the guest returns to the tab).
