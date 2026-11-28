/**
 * Console inventory calendar: what /book offers each night, per room type, and why.
 * Pure and browser-safe so the same numbers can be tested and shown. Rules match the booking page:
 * the Google Sheet's count (once the sheet has synced; else the full room count), less console blocks.
 */
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { closedUnits, type ClosureRow } from '@/booking/consoleClosures';
import { addDays, type IsoDate } from '@/booking/dates';
import { sheetCapacity, type SheetAvailability } from '@/booking/sheetAvailability';
import { ENGINE_ROOM_ID } from '@/data/publicRates';
import { CAMP, CAMP_TENTS, CAMP_UNIT_ID } from '@/data/shnonpedengCamp';
import { CAMP_PROPERTY_ID } from '@/integrations/xtsy-saas/catalogue';

export const HOSTEL_PROPERTY_ID = 'XTSY-SHL-HOSTEL';

export interface CalendarRoom {
  /** Booking-engine id (or the camp's tent id). */
  id: string;
  name: string;
  short: string;
  unit: 'bed' | 'room' | 'tent';
  total: number;
  /** Id the console's block form uses. */
  consoleUnitId: string;
  propertyId: string;
  /** Where the starting count comes from. */
  source: 'sheet' | 'catalogue';
}

const CONSOLE_ID: Record<string, string> = Object.fromEntries(Object.entries(ENGINE_ROOM_ID).map(([consoleId, engineId]) => [engineId, consoleId]));

const SHORT: Record<string, string> = {
  'bed-in-8-bed-mixed-dormitory': '8-bed mixed',
  'bed-in-6-bed-standard-dormitory': '6-bed standard',
  'bed-in-6-bed-mixed-dormitory': '6-bed mixed',
  'bed-in-4-bed-female-deluxe-dormitory': '4-bed female',
  'king-room-with-mountain-view': 'King Room',
  'triple-room-with-mountain-view': 'Triple Room',
  'experience-by-xtsy': 'Experience by XTSY',
};

export function calendarRooms(): CalendarRoom[] {
  return [
    ...BOOKING_ROOM_TYPES.map((r) => ({
      id: r.id, name: r.name, short: SHORT[r.id] ?? r.name, unit: r.soldAs, total: r.units,
      consoleUnitId: CONSOLE_ID[r.id] ?? r.id, propertyId: HOSTEL_PROPERTY_ID, source: 'sheet' as const,
    })),
    { id: CAMP_UNIT_ID, name: CAMP.name, short: 'Shnonpedeng tents', unit: 'tent' as const, total: CAMP_TENTS, consoleUnitId: CAMP_UNIT_ID, propertyId: CAMP_PROPERTY_ID, source: 'catalogue' as const },
  ];
}

export interface CalendarCell {
  night: IsoDate;
  /** Starting count before console blocks. */
  start: number;
  /** Closed by console blocks (capped at the starting count). */
  closed: number;
  /** Held by OTA bookings from ZimmerStack (until the sheet is edited for that night). */
  ota: number;
  free: number;
  /** The sheet had no number for this night (after it has synced, such nights are not bookable). */
  sheetMissing: boolean;
}

export interface CalendarRow extends CalendarRoom { cells: CalendarCell[] }

export function buildCalendar(start: IsoDate, days: number, sheet: SheetAvailability, closures: ClosureRow[], rooms = calendarRooms(), otaHolds: ClosureRow[] = []): CalendarRow[] {
  const nights = Array.from({ length: days }, (_, i) => addDays(start, i));
  return rooms.map((room) => ({
    ...room,
    cells: nights.map((night) => {
      const fromSheet = room.source === 'sheet';
      const startCount = fromSheet ? sheetCapacity(sheet, room.id, night, room.total) : room.total;
      const closed = Math.min(startCount, closedUnits(closures, room.id, night));
      const ota = Math.min(startCount - closed, closedUnits(otaHolds, room.id, night));
      return {
        night, start: startCount, closed, ota, free: Math.max(0, startCount - closed - ota),
        sheetMissing: fromSheet && Object.keys(sheet).length > 0 && sheet[room.id]?.[night] === undefined,
      };
    }),
  }));
}

/** Free and total across rooms, e.g. for "tonight" — beds and rooms are counted separately. */
export function totals(rows: CalendarRow[], index: number) {
  const sum = (u: CalendarRoom['unit']) => rows.filter((r) => r.unit === u).reduce((s, r) => ({ free: s.free + (r.cells[index]?.free ?? 0), total: s.total + r.total }), { free: 0, total: 0 });
  return { beds: sum('bed'), rooms: sum('room'), tents: sum('tent') };
}
