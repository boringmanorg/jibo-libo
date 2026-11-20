/**
 * Availability from the owner's Google Sheet ("Room Management" tab). Browser-safe.
 *
 * The sheet has one row per room number and, for each date, the number of free beds or rooms
 * (the cell to the left of the MM/DD date). A script in the sheet sends those numbers; the server
 * adds them up per booking-engine room type and night. On /book the sheet's number is the
 * starting count for that night, and console blocks are taken off it.
 *
 * Owner, 21 Nov 2026: rooms 9 and 10 (4-bed female dorm) hold long-stay guests, so room 10 is
 * always 0 and room 9 has 1 bed; the 6-bed standard dorms (rooms 2 and 3) have one extra bed each.
 * The sheet's numbers already say this, so nothing here adjusts them.
 */
import type { IsoDate } from './dates';

/** Room number in the sheet → booking-engine room type. Room numbers stay the same month to month. */
export const SHEET_ROOM_NUMBERS: Readonly<Record<string, string>> = {
  '9': 'bed-in-4-bed-female-deluxe-dormitory',
  '10': 'bed-in-4-bed-female-deluxe-dormitory',
  '4': 'bed-in-6-bed-mixed-dormitory',
  '5': 'bed-in-6-bed-mixed-dormitory',
  '7': 'bed-in-6-bed-mixed-dormitory',
  '2': 'bed-in-6-bed-standard-dormitory',
  '3': 'bed-in-6-bed-standard-dormitory',
  '8': 'bed-in-8-bed-mixed-dormitory',
  '1': 'king-room-with-mountain-view',
  '6': 'king-room-with-mountain-view',
  '11': 'triple-room-with-mountain-view',
  '666': 'experience-by-xtsy',
};

/** Free beds or rooms per room type per night, as the sheet says. */
export type SheetAvailability = Record<string, Record<IsoDate, number>>;

export interface SheetCell { roomNo: string; night: IsoDate; free: number }

/** Adds the sheet's room-number rows up per room type and night. Unknown room numbers are listed, not guessed. */
export function aggregateSheet(cells: SheetCell[]): { availability: SheetAvailability; unknownRooms: string[] } {
  const availability: SheetAvailability = {};
  const unknown = new Set<string>();
  for (const c of cells) {
    const id = SHEET_ROOM_NUMBERS[c.roomNo.trim()];
    if (!id) { unknown.add(c.roomNo.trim()); continue; }
    const room = (availability[id] ??= {});
    room[c.night] = (room[c.night] ?? 0) + Math.max(0, Math.floor(c.free));
  }
  return { availability, unknownRooms: [...unknown].sort() };
}

/** True once the sheet has sent anything: from then on the sheet is the only source of availability. */
export const sheetActive = (sheet: SheetAvailability | undefined) => !!sheet && Object.keys(sheet).length > 0;

/**
 * Starting count for a room type on a night.
 * - Sheet connected: the sheet's number; a night it doesn't cover (past its last month, or a blank
 *   cell) is not bookable, so the website never offers more than the sheet says.
 * - Sheet never connected: the catalogue's full count, as before.
 */
export const sheetCapacity = (sheet: SheetAvailability | undefined, roomTypeId: string, night: IsoDate, catalogueUnits: number) =>
  sheetActive(sheet) ? sheet![roomTypeId]?.[night] ?? 0 : catalogueUnits;
