# Google Sheet → xtsy.one availability

The owner keeps live availability in the **Room Management** tab of the "Room Management" Google Sheet.
`availability-sync.gs` runs inside that sheet and sends the date-wise free counts to the website, which
then shows them on /book (console blocks are taken off on top).

Only room numbers, dates and counts are sent. Guest names, notes and the Raw Data tab never leave the sheet.

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
     (the script reads this spreadsheet and sends data to xtsy.one). After that it syncs after edits
     (at most every 30 seconds) and every 10 minutes.
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
- The next 240 nights from today are sent. Nights the sheet has no number for use the full room count.
