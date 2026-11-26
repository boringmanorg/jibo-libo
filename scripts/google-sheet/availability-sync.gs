/**
 * @OnlyCurrentDoc
 *
 * XTSY Room Management ⇄ xtsy.one (Google Apps Script).
 *
 * What it does, on the "Room Management" tab only (never "Tours", "Rates" or "Raw Data"):
 *   1. Writes OTA bookings (from ZimmerStack) and xtsy.one bookings into the tab the way the owner
 *      writes them by hand: it lowers that night's count and adds the note "Priyanka Sharma 2B MMT"
 *      (dorms: B = beds) or "Rahul Das 2G XTSY" (private rooms: G = guests). A cancellation gives the
 *      count back and marks the note "(cancelled)". The owner types only offline bookings.
 *   2. Sends the date-wise free counts to the website, which shows them on /book.
 * It changes only the count and note cells of the nights a booking covers, and never a cell that
 * holds a formula's count. @OnlyCurrentDoc limits Google's permission to this one file.
 *
 * Paste this whole file into the sheet: Extensions → Apps Script → Code.gs, then follow
 * scripts/google-sheet/README.md. Only room numbers, dates and counts are sent to the website; guest
 * names and notes never leave the sheet.
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
 * Walks the month blocks and calls visit(rowIndex, noteColIndex, roomNo, night) for every room row
 * and date (the count is in noteColIndex - 1). Pure; used by the reader and the writer.
 */
function walkRoomManagement(values, visit) {
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
    for (var i = 0; i < dateCols.length; i++) visit(r, dateCols[i].col, roomNo, year + '-' + pad(month) + '-' + pad(dateCols[i].day));
  }
}

/**
 * Pure parser (tested in the website repo): sheet display values → [{ roomNo, night, free }].
 * Every night from today to the end of the last month block is included; no cut-off.
 */
function parseRoomManagement(values, todayIso) {
  var cells = [];
  walkRoomManagement(values, function (r, col, roomNo, night) {
    var raw = String(values[r][col - 1] || '').trim();
    if (!/^\d+$/.test(raw) || night < todayIso) return;
    cells.push({ roomNo: roomNo, night: night, free: Number(raw) });
  });
  return cells;
}

function pad(n) { return (n < 10 ? '0' : '') + n; }
function todayIndia() { return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd'); }

// ---------------------------------------------------------------- writing bookings (pure parts)

/** 'roomNo|night' → { row, col } of the note cell (the count is one column left). */
function locateCells(values) {
  var out = {};
  walkRoomManagement(values, function (r, col, roomNo, night) { out[roomNo + '|' + night] = { row: r, col: col }; });
  return out;
}

/** Nights of a stay: check-in up to the night before check-out (YYYY-MM-DD). */
function stayNights(checkIn, checkOut) {
  var out = [];
  var d = new Date(checkIn + 'T00:00:00Z'), end = new Date(checkOut + 'T00:00:00Z');
  for (var i = 0; d < end && i < 400; i++) { out.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
  return out;
}

/** A note as the owner writes it: "Priyanka Sharma 2B MMT" (beds) or "Rahul Das 2G XTSY" (guests). */
function noteText(name, count, letter, tag) { return name + ' ' + count + letter + ' ' + tag; }

/** Adds a note to whatever the cell already says, the owner's way: "A 1B MMT + B 2B XTSY". */
function addNote(existing, note) {
  var s = String(existing || '').trim();
  return s ? s + ' + ' + note : note;
}

/** Marks a note cancelled; if the owner changed the cell, says so at the end instead. */
function cancelNote(existing, note) {
  var s = String(existing || '').trim();
  var i = s.indexOf(note);
  if (i >= 0 && s.slice(i + note.length, i + note.length + 12) !== ' (cancelled)') return s.slice(0, i + note.length) + ' (cancelled)' + s.slice(i + note.length);
  return addNote(s, note + ' (cancelled)');
}

/**
 * Where a booking goes (pure, tested in the website repo).
 * For each room type: the lowest-numbered room that has space for the whole group on every night;
 * only if none has, the group is split across rooms in number order. A night that cannot fit
 * everyone is written OVERBOOKED (the count never goes below 0) and reported to the console.
 * `free(roomNo, night)` returns the count, or null when the sheet has no such cell.
 * Returns { cells: [{ roomNo, night, units, take, note }], problem } or { missing } when a night is
 * not in the sheet yet (nothing is written then; it is tried again on the next run).
 */
function planBook(w, free) {
  var nights = stayNights(w.checkIn, w.checkOut);
  var cells = [], problems = [];
  var left = {}; // working copy of counts, so two room types or two rooms never take the same bed
  function get(no, n) { var k = no + '|' + n; if (!(k in left)) left[k] = free(no, n); return left[k]; }
  for (var li = 0; li < w.rooms.length; li++) {
    var line = w.rooms[li];
    for (var ni = 0; ni < nights.length; ni++) {
      var any = false;
      for (var ri = 0; ri < line.roomNos.length; ri++) if (get(line.roomNos[ri], nights[ni]) !== null) any = true;
      if (!any) return { missing: 'The sheet has no ' + nights[ni] + ' for room ' + line.roomNos.join('/') + ' yet (add that month).' };
    }
  }
  for (li = 0; li < w.rooms.length; li++) {
    line = w.rooms[li];
    var alloc = {}; // night → [{ roomNo, units }]
    nights.forEach(function (n) { alloc[n] = []; });
    var minFree = function (no) { var m = Infinity; nights.forEach(function (n) { m = Math.min(m, get(no, n) || 0); }); return m; };
    var take = function (no, n, u) { alloc[n].push({ roomNo: no, units: u }); left[no + '|' + n] = (get(no, n) || 0) - u; };
    var need = line.units;
    // 1. One room for the whole group, every night.
    for (ri = 0; ri < line.roomNos.length; ri++) {
      if (minFree(line.roomNos[ri]) >= need) { nights.forEach(function (n) { take(line.roomNos[ri], n, need); }); need = 0; break; }
    }
    // 2. Split across rooms in number order, the same rooms every night.
    for (ri = 0; ri < line.roomNos.length && need > 0; ri++) {
      var k = Math.min(need, minFree(line.roomNos[ri]));
      if (k > 0) { nights.forEach(function (n) { take(line.roomNos[ri], n, k); }); need -= k; }
    }
    // 3. Still short: night by night, wherever there is space; 4. otherwise OVERBOOKED.
    nights.forEach(function (n) {
      var short = need;
      for (var j = 0; j < line.roomNos.length && short > 0; j++) {
        var f = get(line.roomNos[j], n) || 0;
        if (f > 0) { var u = Math.min(short, f); take(line.roomNos[j], n, u); short -= u; }
      }
      if (short > 0) {
        var first = line.roomNos[0];
        for (j = 0; j < line.roomNos.length; j++) if (get(line.roomNos[j], n) !== null) { first = line.roomNos[j]; break; }
        alloc[n].push({ roomNo: first, units: short, over: true });
        problems.push('OVERBOOKED: room ' + first + ' on ' + n + ' (' + short + (line.letter === 'B' ? ' bed' : ' room') + (short > 1 ? 's' : '') + ' short)');
      }
    });
    nights.forEach(function (n) {
      alloc[n].forEach(function (a) {
        var count = line.letter === 'B' ? a.units : Math.max(a.units, Math.round(line.guests * a.units / Math.max(1, line.units)));
        cells.push({ roomNo: a.roomNo, night: n, units: a.over ? 0 : a.units, take: a.over ? 0 : a.units,
          note: noteText(w.guestName, count, line.letter, w.tag) + (a.over ? ' OVERBOOKED' : '') });
      });
    });
  }
  return { cells: cells, problem: problems.length ? problems.join('; ').slice(0, 290) : undefined };
}

/** A cancellation gives back exactly what its booking took, in the same cells. */
function planCancel(w) {
  return { cells: (w.placed || []).map(function (p) { return { roomNo: p.roomNo, night: p.night, units: p.units, give: p.units, note: p.note }; }) };
}

// ---------------------------------------------------------------- sync

/**
 * Writes new bookings, then sends the sheet's availability to the website: on every saved edit, on
 * structural changes (rows or columns added), every minute as a backup, and from the XTSY menu.
 * If an edit arrives while a sync is running, one more sync runs straight after, so the website
 * always ends on the latest numbers.
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

function post(props, path, payload) {
  var res = UrlFetchApp.fetch(siteUrl(props) + path, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + props.getProperty('LINK_TOKEN') },
    payload: JSON.stringify(payload),
  });
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) { /* not JSON */ }
  return { code: res.getResponseCode(), body: body, text: res.getContentText() };
}

/**
 * Collects the bookings the website wants in the sheet and writes them in. Each one is remembered
 * (DONE_<id>) the moment it is written, so it is never written twice, even if the website does not
 * hear back this time. Returns what to report with the counts.
 */
function writeBookings(props, sheet) {
  var got = post(props, '/api/public/hooks/sheet-writes', {});
  var writes = got.code === 200 && got.body.writes ? got.body.writes : [];
  var waiting = [];
  if (writes.length) {
    var range = sheet.getDataRange();
    var values = range.getDisplayValues();
    var formulas = range.getFormulas();
    var loc = locateCells(values);
    var free = function (no, n) {
      var c = loc[no + '|' + n];
      if (!c) return null;
      var raw = String(values[c.row][c.col - 1] || '').trim();
      return /^\d+$/.test(raw) ? Number(raw) : (raw === '' ? 0 : null);
    };
    for (var i = 0; i < writes.length; i++) {
      var w = writes[i];
      if (props.getProperty('DONE_' + w.id)) continue; // written before; the website hears about it below
      var plan = w.kind === 'cancel' ? planCancel(w) : planBook(w, free);
      if (plan.missing) { waiting.push({ id: w.id, problem: plan.missing }); continue; }
      var placed = [], notes = [];
      for (var j = 0; j < plan.cells.length; j++) {
        var p = plan.cells[j], c = loc[p.roomNo + '|' + p.night];
        if (!c) continue;
        var countCell = sheet.getRange(c.row + 1, c.col);       // left of the date: the count
        var noteCell = sheet.getRange(c.row + 1, c.col + 1);    // the date column: the note
        var now = free(p.roomNo, p.night) || 0;
        var change = w.kind === 'cancel' ? p.give : -Math.min(now, p.take);
        if (change !== 0 && !formulas[c.row][c.col - 1]) {
          countCell.setValue(now + change);
          values[c.row][c.col - 1] = String(now + change);
        } else if (change !== 0) {
          notes.push('room ' + p.roomNo + ' on ' + p.night + ': the count is a formula, left as it is');
          change = 0;
        }
        var note = w.kind === 'cancel' ? cancelNote(values[c.row][c.col], p.note) : addNote(values[c.row][c.col], p.note);
        noteCell.setValue(note);
        values[c.row][c.col] = note;
        placed.push({ roomNo: p.roomNo, night: p.night, units: Math.abs(change), note: p.note });
      }
      var problem = [plan.problem, notes.join('; ')].filter(function (x) { return !!x; }).join('; ').slice(0, 290);
      props.setProperty('DONE_' + w.id, JSON.stringify({ placed: placed, problem: problem || undefined }));
    }
    SpreadsheetApp.flush();
  }
  var applied = [];
  props.getKeys().forEach(function (k) {
    if (k.indexOf('DONE_') !== 0) return;
    var d = JSON.parse(props.getProperty(k));
    applied.push({ id: Number(k.slice(5)), placed: d.placed, problem: d.problem });
  });
  return { applied: applied, waiting: waiting, fetched: got.code };
}

function sendOnce(props) {
  var token = props.getProperty('LINK_TOKEN');
  if (!token) return 'Not connected yet. Use XTSY → Connect to xtsy.one.';
  var sheet = SpreadsheetApp.getActive().getSheetByName(TAB);
  if (!sheet) throw new Error('No "' + TAB + '" tab.');
  var wrote = writeBookings(props, sheet);
  // The counts are read AFTER writing, so they already include the bookings just written.
  var today = todayIndia();
  var cells = parseRoomManagement(sheet.getDataRange().getDisplayValues(), today);
  // Only send the write-back fields when there is something in them, so the counts still go through
  // to a website that has not been published with write-back yet.
  var payload = { from: today, cells: cells };
  if (wrote.applied.length) payload.applied = wrote.applied;
  if (wrote.waiting.length) payload.waiting = wrote.waiting;
  var res = post(props, '/api/public/hooks/sheet-availability', payload);
  (res.body.acked || []).forEach(function (id) { props.deleteProperty('DONE_' + id); });
  var msg = res.code === 403 ? 'Waiting for approval: approve pairing code ' + (props.getProperty('PAIR_CODE') || '') + ' in the XTSY console (Stays).'
    : 'Sent ' + cells.length + ' room-nights' + (wrote.applied.length ? ', wrote ' + wrote.applied.length + ' booking(s)' : '')
      + (wrote.waiting.length ? ', ' + wrote.waiting.length + ' waiting' : '') + ' → ' + res.code + ' ' + res.text.slice(0, 300);
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
    .addItem('Sync with xtsy.one now', 'syncNowFromMenu')
    .addToUi();
}

function syncNowFromMenu() { SpreadsheetApp.getUi().alert(syncAvailability()); }

/** Run once: sync on every saved edit, on structural changes, and every minute (new OTA bookings). */
function setUpTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('syncAvailability').timeBased().everyMinutes(1).create();
  SpreadsheetApp.getUi().alert('Automatic sync is on: every saved edit, plus every minute. ' + syncAvailability());
}
