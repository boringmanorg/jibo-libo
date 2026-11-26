/**
 * Google Sheet write-back: the pure rules (no network, no database), so they are tested alone.
 *
 * The owner writes a booking into the "Room Management" tab as the guest's name, the number of beds
 * (dorms, "2B") or guests (private rooms, "2G") and where it came from ("MMT", "XTSY"), and lowers
 * that night's count. OTA and website bookings are now written the same way by the sheet's script;
 * the owner types only offline bookings.
 */
import { findRoomType } from './catalogue';
import { SHEET_ROOM_NUMBERS } from './sheetAvailability';
import type { IsoDate } from './dates';

/** One room type in a booking as the sheet needs it. */
export interface SheetRoomWant { roomTypeId: string; units: number; guests: number }
/** What the sheet should hold for one booking (null = nothing: cancelled). */
export interface SheetWant { checkIn: IsoDate; checkOut: IsoDate; rooms: SheetRoomWant[]; guestName: string; tag: string }

/** The OTA's short name as the owner writes it in the sheet. */
export function otaTag(otaName: string | null | undefined, otaCode?: string | null): string {
  const s = `${otaName ?? ''} ${otaCode ?? ''}`.toLowerCase();
  if (/goibibo/.test(s)) return 'GOIBIBO';
  if (/makemytrip|\bmmt\b|gommt|go-mmt/.test(s)) return 'MMT';
  if (/booking\.?com|bookingcom|\bbdc\b/.test(s)) return 'BDC';
  if (/agoda/.test(s)) return 'AGODA';
  if (/hostelworld/.test(s)) return 'HW';
  if (/airbnb/.test(s)) return 'AIRBNB';
  if (/expedia/.test(s)) return 'EXPEDIA';
  if (/trip\.?com|tripcom/.test(s)) return 'TRIP';
  if (/yatra/.test(s)) return 'YATRA';
  const letters = (otaName ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return letters || 'OTA';
}

/** The website's own tag. */
export const WEBSITE_TAG = 'XTSY';

/**
 * A guest name safe to put in a sheet cell: one line, no "+" (it separates notes), and never
 * starting with = + - @ (the sheet would treat it as a formula).
 */
export function cleanGuestName(name: string | null | undefined): string {
  const s = String(name ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[=+\-@'\s]+/, '').slice(0, 40).trim();
  return s || 'Guest';
}

/** The sheet's room numbers for a room type, lowest first (the order rooms are filled in). */
export function sheetRoomNumbers(roomTypeId: string): string[] {
  return Object.entries(SHEET_ROOM_NUMBERS).filter(([, id]) => id === roomTypeId).map(([no]) => no).sort((a, b) => Number(a) - Number(b));
}

/** Dorm beds are written "2B"; private rooms count guests, "2G". */
export const soldAsLetter = (roomTypeId: string) => (findRoomType(roomTypeId)?.soldAs === 'bed' ? 'B' : 'G');

/** Same stay, same rooms: nothing needs rewriting (the guest's name alone changing is ignored). */
export function sameStay(a: Pick<SheetWant, 'checkIn' | 'checkOut' | 'rooms'>, b: Pick<SheetWant, 'checkIn' | 'checkOut' | 'rooms'>): boolean {
  if (a.checkIn !== b.checkIn || a.checkOut !== b.checkOut) return false;
  const key = (r: SheetRoomWant[]) => [...r].filter((x) => x.units > 0).sort((x, y) => x.roomTypeId.localeCompare(y.roomTypeId)).map((x) => `${x.roomTypeId}:${x.units}:${x.guests}`).join('|');
  return key(a.rooms) === key(b.rooms);
}

/**
 * Guests per room type for an OTA booking, which gives only the whole party's size: each dorm bed
 * is one guest; the rest share the private rooms (at least one each, at most what a room sleeps).
 */
export function otaRoomGuests(rooms: { roomTypeId: string; units: number }[], adults: number, children: number): SheetRoomWant[] {
  const party = Math.max(0, adults) + Math.max(0, children);
  const out = rooms.filter((r) => r.units > 0).map((r) => ({ ...r, guests: r.units }));
  const privateRooms = out.filter((r) => soldAsLetter(r.roomTypeId) === 'G');
  const dormBeds = out.filter((r) => soldAsLetter(r.roomTypeId) === 'B').reduce((s, r) => s + r.units, 0);
  let extra = Math.max(0, party - dormBeds - privateRooms.reduce((s, r) => s + r.units, 0));
  for (const r of privateRooms) {
    const room = Math.max(1, findRoomType(r.roomTypeId)?.maxGuestsPerUnit ?? 1) * r.units;
    const add = Math.min(extra, room - r.guests);
    r.guests += add;
    extra -= add;
  }
  return out;
}

/** Only the hostel's rooms that have sheet rows are written (the camp has no sheet). */
export const writableRooms = (rooms: SheetRoomWant[]) => rooms.filter((r) => r.units > 0 && sheetRoomNumbers(r.roomTypeId).length > 0);

/** A request as the sheet's script receives it. */
export interface SheetWriteForScript {
  id: number;
  kind: 'book' | 'cancel';
  guestName: string;
  tag: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  rooms: { roomTypeId: string; units: number; guests: number; letter: 'B' | 'G'; roomNos: string[] }[];
  /** For a cancel: what the booking's request wrote, to be given back. */
  placed?: PlacedCell[];
}
export interface PlacedCell { roomNo: string; night: IsoDate; units: number; note: string }

/** A queued row (be_sheet_writes) → what the script needs. */
export function forScript(row: { id: number; kind: 'book' | 'cancel'; guest_name: string; tag: string; check_in: string; check_out: string; rooms: SheetRoomWant[] }, placed?: PlacedCell[] | null): SheetWriteForScript {
  return {
    id: Number(row.id), kind: row.kind, guestName: cleanGuestName(row.guest_name), tag: row.tag,
    checkIn: String(row.check_in).slice(0, 10) as IsoDate, checkOut: String(row.check_out).slice(0, 10) as IsoDate,
    rooms: (row.rooms ?? []).map((r) => ({ ...r, letter: soldAsLetter(r.roomTypeId), roomNos: sheetRoomNumbers(r.roomTypeId) })),
    ...(row.kind === 'cancel' ? { placed: placed ?? [] } : {}),
  };
}
