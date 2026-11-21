/**
 * @OnlyCurrentDoc
 *
 * XTSY Room Management → xtsy.one availability sync (Google Apps Script).
 *
 * READ-ONLY by design: it reads the "Room Management" tab and nothing else (not "Tours", "Rates" or
 * "Raw Data"), and it never writes to the spreadsheet. @OnlyCurrentDoc limits Google's permission
 * to this one file.
 *
 * Paste this whole file into the sheet: Extensions → Apps Script → Code.gs, then follow
 * scripts/google-sheet/README.md. It sends ONLY room numbers, dates and the free count for each date,
 * from today to the last month in the sheet. Guest names and notes never leave the sheet.
 *
 * Sheet format it understands (as kept by the owner):
 *   - a month label in column A, e.g. "December 2026";
 *   - the next row is a header with dates as MM/DD (e.g. "12/13" = 13 Dec); the cell just LEFT of
 *     each date column holds that date's free count, the date column itself holds the guest note;
 *   - one row per room: column A room name, column B room number.
 */

var TAB = 'Room Management';
var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * Pure parser (tested in the website repo): sheet display values → [{ roomNo, night, free }].
 * Every night from today to the end of the last month block is included; no cut-off.
 */
function parseRoomManagement(values, todayIso) {
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
      if (night < todayIso) continue;
      cells.push({ roomNo: roomNo, night: night, free: Number(raw) });
    }
  }
  return cells;
}

function pad(n) { return (n < 10 ? '0' : '') + n; }
function todayIndia() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'); }

/**
 * Sends the sheet's availability to the website: on every saved edit, on structural changes
 * (rows or columns added), every minute as a backup, and from the XTSY menu.
 * If an edit arrives while a sync is running, one more sync runs straight after, so the website
 * always ends on the latest numbers. The website publishes each sync at the next minute boundary,
 * when every open booking page switches to it together.
 */
function syncAvailability() {
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(500)) { props.setProperty('PENDING', '1'); return 'Another sync is running; your change follows straight after it.'; }
  var msg = '';
  try {
    for (var round = 0; round < 3; round++) {
      props.deleteProperty('PENDING');
      msg = sendOnce(props);
      if (props.getProperty('PENDING') !== '1') break;
    }
  } finally {
    lock.releaseLock();
  }
  return msg;
}

function siteUrl(props) { return props.getProperty('SITE_URL') || 'https://xtsy.one'; }

function sendOnce(props) {
  var token = props.getProperty('LINK_TOKEN');
  if (!token) return 'Not connected yet. Use XTSY → Connect to xtsy.one.';
  // Reads ONLY the Room Management tab, display values (as you see them), never writes.
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB);
  if (!sheet) throw new Error('No "' + TAB + '" tab.');
  var today = todayIndia();
  var cells = parseRoomManagement(sheet.getDataRange().getDisplayValues(), today);
  var res = UrlFetchApp.fetch(siteUrl(props) + '/api/public/hooks/sheet-availability', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ from: today, cells: cells }),
  });
  var code = res.getResponseCode();
  var msg = code === 403 ? 'Waiting for approval: approve pairing code ' + (props.getProperty('PAIR_CODE') || '') + ' in the XTSY console (Stays).'
    : 'Sent ' + cells.length + ' room-nights → ' + code + ' ' + res.getContentText().slice(0, 300);
  props.setProperty('LAST_SYNC', new Date().toISOString() + ' ' + msg);
  console.log(msg);
  return msg;
}

/** Asks xtsy.one to accept this sheet. No password: the owner approves the code in the console. */
function connectToSite() {
  var props = PropertiesService.getScriptProperties();
  var res = UrlFetchApp.fetch(siteUrl(props) + '/api/public/hooks/sheet-pair', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ label: SpreadsheetApp.getActive().getName().slice(0, 80) }),
  });
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) { /* not JSON */ }
  if (res.getResponseCode() !== 200 || !body.token) {
    SpreadsheetApp.getUi().alert('Could not start pairing: ' + (body.error || res.getResponseCode()));
    return;
  }
  props.setProperty('LINK_TOKEN', body.token);
  props.setProperty('PAIR_CODE', body.code);
  SpreadsheetApp.getUi().alert('Pairing code: ' + body.code + '\n\nOpen the XTSY console → Stays → Google Sheet, check the code matches and press Approve (within 30 minutes). Then choose XTSY → Set up automatic sync.');
}

/** Installable on-edit trigger: syncs straight away when a cell on the Room Management tab is saved. */
function onSheetEdit(e) {
  if (e && e.range && e.range.getSheet().getName() !== TAB) return; // edits on other tabs are ignored
  syncAvailability();
}

/** Installable on-change trigger: rows or columns added or removed, pasted blocks, a new month. */
function onSheetChange() { syncAvailability(); }

/** Adds an "XTSY" menu to the sheet (menus are not edits; nothing in the sheet changes). */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('XTSY')
    .addItem('Connect to xtsy.one (once)', 'connectToSite')
    .addItem('Set up automatic sync (once, after approval)', 'setUpTriggers')
    .addItem('Send availability to xtsy.one now', 'syncNowFromMenu')
    .addToUi();
}

function syncNowFromMenu() { SpreadsheetApp.getUi().alert(syncAvailability()); }

/** Run once: sync on every saved edit, on structural changes, and every minute as a backup. */
function setUpTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('syncAvailability').timeBased().everyMinutes(1).create();
  SpreadsheetApp.getUi().alert('Automatic sync is on: every saved edit, plus every minute. ' + syncAvailability());
}
