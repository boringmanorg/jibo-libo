/**
 * XTSY Room Management → xtsy.one availability sync (Google Apps Script).
 *
 * Paste this whole file into the sheet: Extensions → Apps Script → Code.gs, then follow
 * scripts/google-sheet/README.md. It reads the "Room Management" tab and sends ONLY room numbers,
 * dates and the free count for each date. Guest names and notes never leave the sheet.
 *
 * Sheet format it understands (as kept by the owner):
 *   - a month label in column A, e.g. "December 2026";
 *   - the next row is a header with dates as MM/DD (e.g. "12/13" = 13 Dec); the cell just LEFT of
 *     each date column holds that date's free count, the date column itself holds the guest note;
 *   - one row per room: column A room name, column B room number.
 */

var TAB = 'Room Management';
var WINDOW_NIGHTS = 240;
var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Pure parser (tested in the website repo): sheet display values → [{ roomNo, night, free }]. */
function parseRoomManagement(values, todayIso, windowNights) {
  var end = addDaysIso(todayIso, windowNights);
  var cells = [];
  var year = null, month = null, dateCols = null;
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var a = String(row[0] || '').trim();
    var label = a.toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
    if (label && MONTHS.indexOf(label[1]) >= 0) {
      month = MONTHS.indexOf(label[1]) + 1; year = Number(label[2]); dateCols = null;
      continue;
    }
    // A month label without a full year ("February ", "July 26"): skip that block rather than guess.
    if (MONTHS.indexOf(a.toLowerCase().split(/\s+/)[0]) >= 0) { year = null; dateCols = null; continue; }
    if (!year) continue;
    // The first header after a month label carries the MM/DD dates; later headers repeat without dates.
    if (!dateCols && /travellers hostel/i.test(a)) {
      var cols = [];
      for (var c = 1; c < row.length; c++) {
        var m = String(row[c] || '').trim().match(/^(\d{1,2})\/(\d{1,2})$/);
        if (m && Number(m[1]) === month) cols.push({ col: c, day: Number(m[2]) });
      }
      dateCols = cols;
      continue;
    }
    if (!dateCols || /travellers hostel/i.test(a)) continue;
    var roomNo = String(row[1] || '').trim();
    if (!a || !/^\d+$/.test(roomNo)) continue;
    for (var i = 0; i < dateCols.length; i++) {
      var raw = String(row[dateCols[i].col - 1] || '').trim();
      if (!/^\d+$/.test(raw)) continue;
      var night = year + '-' + pad(month) + '-' + pad(dateCols[i].day);
      if (night < todayIso || night >= end) continue;
      cells.push({ roomNo: roomNo, night: night, free: Number(raw) });
    }
  }
  return cells;
}

function pad(n) { return (n < 10 ? '0' : '') + n; }
function addDaysIso(iso, n) {
  var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function todayIndia() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'); }

/** Sends the next WINDOW_NIGHTS nights to the website. Runs from the menu, on edit and every 10 minutes. */
function syncAvailability() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('SHEET_SYNC_SECRET');
    var site = props.getProperty('SITE_URL') || 'https://www.xtsy.one';
    if (!secret) throw new Error('Add SHEET_SYNC_SECRET in Project Settings → Script Properties.');
    var sheet = SpreadsheetApp.getActive().getSheetByName(TAB);
    if (!sheet) throw new Error('No "' + TAB + '" tab.');
    var cells = parseRoomManagement(sheet.getDataRange().getDisplayValues(), todayIndia(), WINDOW_NIGHTS);
    var res = UrlFetchApp.fetch(site + '/api/public/hooks/sheet-availability', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + secret },
      payload: JSON.stringify({ cells: cells }),
    });
    var msg = 'Sent ' + cells.length + ' room-nights → ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300);
    props.setProperty('LAST_SYNC', new Date().toISOString() + ' ' + msg);
    console.log(msg);
    return msg;
  } finally {
    lock.releaseLock();
  }
}

/** Edits sync at most once every 30 seconds; the 10-minute timer catches anything in between. */
function onEditSync() {
  var cache = CacheService.getScriptCache();
  if (cache.get('recent')) return;
  cache.put('recent', '1', 30);
  syncAvailability();
}

/** Adds an "XTSY" menu to the sheet. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('XTSY')
    .addItem('Send availability to xtsy.one now', 'syncNowFromMenu')
    .addItem('Set up automatic sync (run once)', 'setUpTriggers')
    .addToUi();
}

function syncNowFromMenu() { SpreadsheetApp.getUi().alert(syncAvailability() || 'Another sync is running; try again in a moment.'); }

/** Run once: sync on every edit (throttled) and every 10 minutes. */
function setUpTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onEditSync').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger('syncAvailability').timeBased().everyMinutes(10).create();
  SpreadsheetApp.getUi().alert('Automatic sync is on: after edits and every 10 minutes.');
}
