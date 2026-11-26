import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanGuestName, forScript, otaRoomGuests, otaTag, sameStay, sheetRoomNumbers } from '@/booking/sheetWritePlan';
import { queueOtaBooking, queueWebsiteBooking, recordSheetAcks, reconcileSheetWrites, pendingForSheet, sheetWriteIssues } from '@/booking/sheetWrites.server';
import { otaHolds, type OtaBookingRow } from '@/booking/channel/zimmerstackPlan';

// The Apps Script, loaded from the .gs file the owner pastes into the sheet.
const gs = readFileSync('scripts/google-sheet/availability-sync.gs', 'utf8');
const S = new Function(`${gs}; return { planBook, planCancel, locateCells, addNote, cancelNote, parseRoomManagement, stayNights };`)() as any;

/** A month block like the owner's sheet: [count, note] pairs after "Current AVL" / "MM/DD". */
function block(label: string, mm: string, days: number, rooms: [string, string, number][]) {
  const header = ['XTSY Travellers Hostel', 'Room Number', ''];
  for (let d = 1; d <= days; d++) header.push('Current AVL', `${mm}/${String(d).padStart(2, '0')}`);
  return [[label], header, ...rooms.map(([name, no, free]) => {
    const r = [name, no, ''];
    for (let d = 1; d <= days; d++) r.push(String(free), '');
    return r;
  })];
}
const ROOMS: [string, string, number][] = [
  ['Bed in 4 Bed Female Dormitory', '9', 1], ['Bed in 4 Bed Female Dormitory', '10', 0],
  ['Bed in 6 Bed Mixed Dormitory', '4', 6], ['Bed in 6 Bed Mixed Dormitory', '5', 6], ['Bed in 6 Bed Mixed Dormitory', '7', 6],
  ['Bed in 6 Bed Mixed Standard Dormitory', '2', 7], ['Bed in 6 Bed Mixed Standard Dormitory', '3', 7],
  ['Bed in 8 Bed Mixed Dormitory', '8', 8], ['King Room with Mountain View', '1', 1], ['King Room with Mountain View', '6', 1],
  ['Triple Room with Mountain View', '11', 1], ['Experience by XTSY', '666', 1],
];
const sheet = () => [...block('November 2026', '11', 30, ROOMS), [], ...block('December 2026', '12', 31, ROOMS)];

/** Runs the script's plan against a sheet grid and applies it the way the script does. */
function apply(values: string[][], w: any) {
  const loc = S.locateCells(values);
  const free = (no: string, n: string) => { const c = loc[`${no}|${n}`]; if (!c) return null; const raw = values[c.row][c.col - 1]; return /^\d+$/.test(raw) ? Number(raw) : raw === '' ? 0 : null; };
  const plan = w.kind === 'cancel' ? S.planCancel(w) : S.planBook(w, free);
  if (plan.missing) return plan;
  const placed: any[] = [];
  for (const p of plan.cells) {
    const c = loc[`${p.roomNo}|${p.night}`];
    const now = free(p.roomNo, p.night) ?? 0;
    const change = w.kind === 'cancel' ? p.give : -Math.min(now, p.take);
    values[c.row][c.col - 1] = String(now + change);
    values[c.row][c.col] = w.kind === 'cancel' ? S.cancelNote(values[c.row][c.col], p.note) : S.addNote(values[c.row][c.col], p.note);
    placed.push({ roomNo: p.roomNo, night: p.night, units: Math.abs(change), note: p.note });
  }
  return { ...plan, placed };
}
const cell = (values: string[][], roomNo: string, night: string) => { const c = S.locateCells(values)[`${roomNo}|${night}`]; return { count: values[c.row][c.col - 1], note: values[c.row][c.col] }; };
const book = (over: any = {}) => forScript({ id: 1, kind: 'book', guest_name: 'Priyanka Sharma', tag: 'MMT', check_in: '2026-11-28', check_out: '2026-11-30', rooms: [{ roomTypeId: 'bed-in-6-bed-mixed-dormitory', units: 2, guests: 2 }], ...over });

describe('writing bookings into Room Management (the sheet script)', () => {
  it('puts the whole group in the lowest-numbered room that fits, every night, as "Name 2B MMT"', () => {
    const v = sheet();
    const r = apply(v, book());
    expect(r.problem).toBeUndefined();
    for (const n of ['2026-11-28', '2026-11-29']) expect(cell(v, '4', n)).toEqual({ count: '4', note: 'Priyanka Sharma 2B MMT' });
    expect(cell(v, '4', '2026-11-30')).toEqual({ count: '6', note: '' }); // check-out day untouched
    expect(cell(v, '5', '2026-11-28').count).toBe('6');
  });

  it('skips a room without space for everyone, and splits across rooms in number order only if none fits', () => {
    const v = sheet();
    apply(v, book({ rooms: [{ roomTypeId: 'bed-in-6-bed-mixed-dormitory', units: 5, guests: 5 }], guest_name: 'Group A' }));
    apply(v, book({ id: 2, rooms: [{ roomTypeId: 'bed-in-6-bed-mixed-dormitory', units: 3, guests: 3 }], guest_name: 'Subash Shankar', tag: 'BDC' }));
    expect(cell(v, '4', '2026-11-28')).toEqual({ count: '1', note: 'Group A 5B MMT' });
    expect(cell(v, '5', '2026-11-28')).toEqual({ count: '3', note: 'Subash Shankar 3B BDC' });
    // 10 beds: rooms 5 (3 left) and 7 (6) cannot each hold them all → 4: 1, 5: 3, 7: 6.
    apply(v, book({ id: 3, rooms: [{ roomTypeId: 'bed-in-6-bed-mixed-dormitory', units: 10, guests: 10 }], guest_name: 'Big Group', tag: 'XTSY' }));
    expect(cell(v, '4', '2026-11-29')).toEqual({ count: '0', note: 'Group A 5B MMT + Big Group 1B XTSY' });
    expect(cell(v, '5', '2026-11-29')).toEqual({ count: '0', note: 'Subash Shankar 3B BDC + Big Group 3B XTSY' });
    expect(cell(v, '7', '2026-11-29')).toEqual({ count: '0', note: 'Big Group 6B XTSY' });
  });

  it('private rooms count guests ("2G"), one room each', () => {
    const v = sheet();
    apply(v, book({ rooms: [{ roomTypeId: 'king-room-with-mountain-view', units: 2, guests: 4 }], guest_name: 'Rahul Das', tag: 'AGODA' }));
    expect(cell(v, '1', '2026-11-28')).toEqual({ count: '0', note: 'Rahul Das 2G AGODA' });
    expect(cell(v, '6', '2026-11-28')).toEqual({ count: '0', note: 'Rahul Das 2G AGODA' });
  });

  it('a stay across two months writes both month blocks', () => {
    const v = sheet();
    apply(v, book({ check_in: '2026-11-30', check_out: '2026-12-02' }));
    expect(cell(v, '4', '2026-11-30').note).toBe('Priyanka Sharma 2B MMT');
    expect(cell(v, '4', '2026-12-01').note).toBe('Priyanka Sharma 2B MMT');
    expect(cell(v, '4', '2026-12-01').count).toBe('4');
  });

  it('never goes below 0: the extra beds are written OVERBOOKED and reported', () => {
    const v = sheet();
    const r = apply(v, book({ rooms: [{ roomTypeId: 'bed-in-4-bed-female-deluxe-dormitory', units: 2, guests: 2 }], guest_name: 'Asha', check_out: '2026-11-29' }));
    expect(cell(v, '9', '2026-11-28')).toEqual({ count: '0', note: 'Asha 1B MMT + Asha 1B MMT OVERBOOKED' });
    expect(cell(v, '10', '2026-11-28')).toEqual({ count: '0', note: '' });
    expect(r.problem).toMatch(/OVERBOOKED: room 9 on 2026-11-28 \(1 bed short\)/);
    expect(r.placed.reduce((s: number, p: any) => s + p.units, 0)).toBe(1); // only one bed was really taken
  });

  it('writes nothing when a night is not in the sheet yet, and says which', () => {
    const v = sheet();
    const before = JSON.stringify(v);
    const r = apply(v, book({ check_in: '2026-12-31', check_out: '2027-01-02' }));
    expect(r.missing).toMatch(/2027-01-01/);
    expect(JSON.stringify(v)).toBe(before);
  });

  it('a cancellation gives back exactly what was taken and marks the note', () => {
    const v = sheet();
    v[4][4] = 'Rama Krishna 1B'; // the owner's own note already in room 4 on 1 Nov
    const done = apply(v, book({ check_in: '2026-11-01', check_out: '2026-11-03' }));
    expect(cell(v, '4', '2026-11-01')).toEqual({ count: '4', note: 'Rama Krishna 1B + Priyanka Sharma 2B MMT' });
    apply(v, forScript({ id: 9, kind: 'cancel', guest_name: 'Priyanka Sharma', tag: 'MMT', check_in: '2026-11-01', check_out: '2026-11-03', rooms: [] }, done.placed));
    expect(cell(v, '4', '2026-11-01')).toEqual({ count: '6', note: 'Rama Krishna 1B + Priyanka Sharma 2B MMT (cancelled)' });
    expect(cell(v, '4', '2026-11-02')).toEqual({ count: '6', note: 'Priyanka Sharma 2B MMT (cancelled)' });
  });

  it('the counts read after writing already include the booking', () => {
    const v = sheet();
    apply(v, book());
    const cells = S.parseRoomManagement(v, '2026-11-26');
    expect(cells.find((c: any) => c.roomNo === '4' && c.night === '2026-11-28').free).toBe(4);
  });
});

describe('how bookings are written (website rules)', () => {
  it('uses the owner’s OTA tags', () => {
    expect(otaTag('MakeMyTrip')).toBe('MMT');
    expect(otaTag('Booking.com')).toBe('BDC');
    expect(otaTag('Agoda')).toBe('AGODA');
    expect(otaTag('Hostelworld')).toBe('HW');
    expect(otaTag('Airbnb')).toBe('AIRBNB');
    expect(otaTag('Goibibo')).toBe('GOIBIBO');
    expect(otaTag('Some New OTA')).toBe('SOMENEWO');
  });

  it('names are one line, without "+", and can never start a formula', () => {
    expect(cleanGuestName('=IMPORTXML("x")')).toBe('IMPORTXML("x")');
    expect(cleanGuestName('  Ana +\nRoy ')).toBe('Ana Roy');
    expect(cleanGuestName('')).toBe('Guest');
  });

  it('room numbers are filled lowest first', () => {
    expect(sheetRoomNumbers('bed-in-6-bed-mixed-dormitory')).toEqual(['4', '5', '7']);
    expect(sheetRoomNumbers('bed-in-4-bed-female-deluxe-dormitory')).toEqual(['9', '10']);
    expect(sheetRoomNumbers('shnonpedeng-tent')).toEqual([]);
  });

  it('an OTA party is shared: a bed per dorm guest, the rest in the private rooms', () => {
    expect(otaRoomGuests([{ roomTypeId: 'bed-in-8-bed-mixed-dormitory', units: 2 }, { roomTypeId: 'king-room-with-mountain-view', units: 1 }], 4, 0))
      .toEqual([{ roomTypeId: 'bed-in-8-bed-mixed-dormitory', units: 2, guests: 2 }, { roomTypeId: 'king-room-with-mountain-view', units: 1, guests: 2 }]);
  });

  it('only a change of dates or rooms rewrites a booking', () => {
    const a = { checkIn: '2026-12-01' as const, checkOut: '2026-12-03' as const, rooms: [{ roomTypeId: 'x', units: 1, guests: 1 }] };
    expect(sameStay(a, { ...a })).toBe(true);
    expect(sameStay(a, { ...a, checkOut: '2026-12-04' })).toBe(false);
  });
});

describe('OTA holds with write-back', () => {
  const row = (over: Partial<OtaBookingRow>): OtaBookingRow => ({ status: 'CONFIRMED', check_in: '2026-12-01', check_out: '2026-12-03', rooms: [{ roomTypeId: 'r', units: 2 }], sheet_at_arrival: { r: { '2026-12-01': 6, '2026-12-02': 6 } }, received_at: 'a', ...over });
  const edited = { r: { '2026-12-01': 5, '2026-12-02': 5 } }; // the owner changed these nights (another guest)
  it('waiting for the sheet: held every night, even if the owner edits those nights for someone else', () => {
    expect(otaHolds([row({ sheet_write: 'queued' })], edited, '2026-11-26')).toHaveLength(2);
  });
  it('written into the sheet: no hold (the sheet counts it)', () => {
    expect(otaHolds([row({ sheet_write: 'applied' })], edited, '2026-11-26')).toHaveLength(0);
  });
  it('write-back off: the old rule (hold until the owner edits the night)', () => {
    expect(otaHolds([row({ sheet_write: null })], edited, '2026-11-26')).toHaveLength(0);
    expect(otaHolds([row({})], { r: { '2026-12-01': 6, '2026-12-02': 6 } }, '2026-11-26')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------- the queue (server)

type Row = Record<string, any>;
function fakeDb(seed: Record<string, Row[]> = {}) {
  const t: Record<string, Row[]> = { be_sheet_links: [], be_sheet_writes: [], be_ota_bookings: [], be_bookings: [], ...seed };
  let seq = 100;
  function from(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'insert' | 'update' = 'select';
    let payload: any;
    let one = false;
    let lim = Infinity;
    const q: any = {
      select: () => q, order: () => q, limit: (n: number) => ((lim = n), q),
      eq: (c: string, v: any) => (filters.push((r) => r[c] === v), q),
      in: (c: string, v: any[]) => (filters.push((r) => v.includes(r[c])), q),
      not: (c: string, _o: string, _v: any) => (filters.push((r) => r[c] !== null && r[c] !== undefined), q),
      gte: (c: string, v: any) => (filters.push((r) => String(r[c]) >= String(v)), q),
      insert: (p: any) => ((op = 'insert'), (payload = p), q),
      update: (p: any) => ((op = 'update'), (payload = p), q),
      maybeSingle: () => ((one = true), q),
      then: (res: (v: any) => void) => {
        const rows = (t[table] ??= []);
        if (op === 'insert') { for (const p of [payload].flat()) rows.push({ id: ++seq, status: 'pending', placed: null, problem: null, cancels: null, created_at: '2026-11-26T05:00:00Z', ...p }); return res({ data: null, error: null }); }
        const hit = rows.filter((r) => filters.every((f) => f(r))).slice(0, lim);
        if (op === 'update') { hit.forEach((r) => Object.assign(r, payload)); return res({ data: hit, error: null }); }
        return res({ data: one ? hit[0] ?? null : hit, error: null });
      },
    };
    return q;
  }
  return { t, from };
}
const link = { id: 'l1', status: 'active', writes_since: '2026-11-26T00:00:00Z' };
const ota = (over: Row = {}) => ({ zs_mode: 'live', zs_booking_id: 77, property_id: 'XTSY-SHL-HOSTEL', status: 'CONFIRMED', ota_name: 'MakeMyTrip', ota_code: 'NH123', check_in: '2026-12-05', check_out: '2026-12-07', guest_name: 'Priyanka Sharma', adults: 2, children: 0, rooms: [{ roomTypeId: 'bed-in-6-bed-mixed-dormitory', units: 2 }], ...over });
const NOW = new Date('2026-11-26T06:00:00Z');
const LIVE_ALL = { channel: true, pms: true, payment: true };
const dep = (db: any, integrations = LIVE_ALL) => ({ db, env: {}, now: NOW, integrations });

describe('the write queue', () => {
  it('nothing is queued until the sheet runs the write-back script', async () => {
    const db = fakeDb({ be_sheet_links: [{ ...link, writes_since: null }], be_ota_bookings: [ota()] });
    expect(await queueOtaBooking(dep(db), 'live', 77)).toBeNull();
    expect(db.t.be_sheet_writes).toHaveLength(0);
  });

  it('nothing is written until channel manager, PMS and online payment are all live', async () => {
    for (const off of [{ ...LIVE_ALL, channel: false }, { ...LIVE_ALL, pms: false }, { ...LIVE_ALL, payment: false }]) {
      const db = fakeDb({ be_sheet_links: [link], be_ota_bookings: [ota()] });
      expect(await queueOtaBooking(dep(db, off), 'live', 77)).toBeNull();
      expect(db.t.be_sheet_writes).toHaveLength(0);
      expect(db.t.be_ota_bookings[0].sheet_write).toBeNull(); // the old rule: held until the owner edits the night
      const issues = await sheetWriteIssues(dep(db, off));
      expect(issues.enabled).toBe(false);
      expect(issues.missing).toHaveLength(1);
    }
  });

  it('a website booking that was never paid is never written', async () => {
    const db = fakeDb({ be_sheet_links: [link], be_bookings: [{ id: 'b2', reference: 'XTSY-HELD', status: 'held', check_in: '2026-12-10', check_out: '2026-12-11', guest_name: 'A', be_booking_lines: [{ room_type_id: 'bed-in-8-bed-mixed-dormitory', units: 1, guests: 1 }] }] });
    expect(await queueWebsiteBooking(dep(db), 'b2')).toBeNull();
    expect(db.t.be_sheet_writes).toHaveLength(0);
  });

  it('a new OTA booking is queued as "Name 2B MMT", held until the sheet has written it', async () => {
    const db = fakeDb({ be_sheet_links: [link], be_ota_bookings: [ota()] });
    expect(await queueOtaBooking(dep(db), 'live', 77)).toBe('queued');
    expect(db.t.be_ota_bookings[0].sheet_write).toBe('queued');
    const [w] = await pendingForSheet(db);
    expect(w).toMatchObject({ kind: 'book', guestName: 'Priyanka Sharma', tag: 'MMT', checkIn: '2026-12-05', rooms: [{ letter: 'B', units: 2, roomNos: ['4', '5', '7'] }] });
    const placed = [{ roomNo: '4', night: '2026-12-05', units: 2, note: 'Priyanka Sharma 2B MMT' }, { roomNo: '4', night: '2026-12-06', units: 2, note: 'Priyanka Sharma 2B MMT' }];
    expect(await recordSheetAcks(db, [{ id: w.id, placed }], [], NOW)).toEqual([w.id]);
    expect(db.t.be_ota_bookings[0].sheet_write).toBe('applied');
    expect(await pendingForSheet(db)).toEqual([]);
    // The same delivery again changes nothing.
    expect(await queueOtaBooking(dep(db), 'live', 77)).toBe('applied');
    expect(db.t.be_sheet_writes).toHaveLength(1);
  });

  it('a cancelled OTA booking gives its beds back with what was written', async () => {
    const db = fakeDb({ be_sheet_links: [link], be_ota_bookings: [ota()] });
    await queueOtaBooking(dep(db), 'live', 77);
    const [w] = await pendingForSheet(db);
    const placed = [{ roomNo: '4', night: '2026-12-05', units: 2, note: 'Priyanka Sharma 2B MMT' }];
    await recordSheetAcks(db, [{ id: w.id, placed }], [], NOW);
    db.t.be_ota_bookings[0].status = 'CANCELLED';
    await queueOtaBooking(dep(db), 'live', 77);
    const [c] = await pendingForSheet(db);
    expect(c).toMatchObject({ kind: 'cancel', placed });
  });

  it('a change before the sheet wrote it simply replaces the request; after, it cancels and rewrites', async () => {
    const db = fakeDb({ be_sheet_links: [link], be_ota_bookings: [ota()] });
    await queueOtaBooking(dep(db), 'live', 77);
    db.t.be_ota_bookings[0].check_out = '2026-12-08';
    await queueOtaBooking(dep(db), 'live', 77);
    expect(db.t.be_sheet_writes.map((w) => `${w.kind}:${w.status}`)).toEqual(['book:superseded', 'book:pending']);
    // The sheet had already written the first one: it is given back.
    await recordSheetAcks(db, [{ id: db.t.be_sheet_writes[0].id, placed: [{ roomNo: '4', night: '2026-12-05', units: 2, note: 'x' }] }], [], NOW);
    expect(db.t.be_sheet_writes.map((w) => `${w.kind}:${w.status}`)).toEqual(['book:superseded', 'book:pending', 'cancel:pending']);
    expect(db.t.be_ota_bookings[0].sheet_write).toBe('queued');
  });

  it('website bookings are tagged XTSY; a cancellation after writing queues a give-back', async () => {
    const db = fakeDb({ be_sheet_links: [link], be_bookings: [{ id: 'b1', reference: 'XTSY-ABC', status: 'confirmed', check_in: '2026-12-10', check_out: '2026-12-11', guest_name: 'Rahul Das', be_booking_lines: [{ room_type_id: 'king-room-with-mountain-view', units: 1, guests: 2 }] }] });
    expect(await queueWebsiteBooking(dep(db), 'b1')).toBe('queued');
    const [w] = await pendingForSheet(db);
    expect(w).toMatchObject({ tag: 'XTSY', rooms: [{ letter: 'G', guests: 2, roomNos: ['1', '6'] }] });
    await recordSheetAcks(db, [{ id: w.id, placed: [{ roomNo: '1', night: '2026-12-10', units: 1, note: 'Rahul Das 2G XTSY' }] }], [], NOW);
    expect(db.t.be_bookings[0].sheet_write).toBe('applied');
    db.t.be_bookings[0].status = 'cancelled_by_guest';
    await queueWebsiteBooking(dep(db), 'b1');
    expect((await pendingForSheet(db))[0]).toMatchObject({ kind: 'cancel' });
  });

  it('a request the sheet cannot write yet shows in the console with the reason', async () => {
    const db = fakeDb({ be_sheet_links: [link], be_ota_bookings: [ota()] });
    await queueOtaBooking(dep(db), 'live', 77);
    const [w] = await pendingForSheet(db);
    await recordSheetAcks(db, [], [{ id: w.id, problem: 'The sheet has no 2026-12-05 for room 4/5/7 yet (add that month).' }], NOW);
    const issues = await sheetWriteIssues(dep(db));
    expect(issues.enabled).toBe(true);
    expect(issues.rows[0].problem).toMatch(/add that month/);
    expect(db.t.be_ota_bookings[0].sheet_write).toBe('queued'); // still held on /book
  });

  it('the camp has no sheet: nothing is queued for it', async () => {
    const db = fakeDb({ be_sheet_links: [link], be_ota_bookings: [ota({ property_id: 'XTSY-SHN-CAMP', rooms: [{ roomTypeId: 'shnonpedeng-tent', units: 1 }] })] });
    expect(await queueOtaBooking(dep(db), 'live', 77)).toBeNull();
    expect(await reconcileSheetWrites(dep(db), 'ota', 'live:1', { checkIn: '2026-12-01', checkOut: '2026-12-02', rooms: [{ roomTypeId: 'shnonpedeng-tent', units: 1, guests: 2 }], guestName: 'A', tag: 'MMT' })).toBeNull();
    expect(db.t.be_sheet_writes).toHaveLength(0);
  });
});
