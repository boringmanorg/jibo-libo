# Google Sheet → xtsy.one availability

The owner keeps live availability in the **Room Management** tab of the "Room Management" Google Sheet.
`availability-sync.gs` runs inside that sheet and sends the date-wise free counts to the website, which
then shows them on /book (console blocks are taken off on top).

Only room numbers, dates and counts are sent. Guest names and notes never leave the sheet.

**Read-only, one tab.** The script reads only the **Room Management** tab (never Tours, Rates or Raw Data)
and never writes anything to the spreadsheet. `@OnlyCurrentDoc` limits Google's permission to this file.
When a channel manager or PMS is connected later, any rule for writing back to the sheet will be agreed
with the owner first; this script has none.

## One-time setup (about 5 minutes)

1. **Make a sync password.** Any long random text, e.g. from a password manager (32+ characters).
   Don't paste it into chat or email.
2. **Website side:** in Lovable → Cloud → Secrets, add `SHEET_SYNC_SECRET` with that value. Publish.
3. **Sheet side:** open the sheet → Extensions → Apps Script.
   - Replace everything in `Code.gs` with the contents of `availability-sync.gs`, then Save.
   - Project Settings (gear) → Script Properties → add `SHEET_SYNC_SECRET` with the same value.
   - (Optional) add `SITE_URL` if the site is not `https://www.xtsy.one`.
4. Reload the sheet. A new **XTSY** menu appears.
   - **XTSY → Set up automatic sync (run once)**: Google asks for permission the first time
     (the script reads this spreadsheet and sends data to xtsy.one). After that **every saved edit
     syncs straight away** (usually within a few seconds), adding rows, columns or a new month syncs
     too, and a 5-minute backup run catches anything missed. If you edit while a sync is running, one
     more sync runs right after, so the website always ends on your latest numbers.
   - **XTSY → Send availability to xtsy.one now** sends immediately and shows the result,
     e.g. `Sent 2,880 room-nights → 200 {"status":"ok",...}`.
5. Check the console: Stays → "Availability from your Google Sheet" shows the last time it arrived.

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
- /book refreshes its numbers every minute while open and whenever the guest returns to the tab.
