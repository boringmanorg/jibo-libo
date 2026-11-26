/**
 * Pure rules for the ZimmerStack connection (no network, no database), so they are tested alone.
 *
 * - What each XTSY property sells on ZimmerStack (room types, room-only rate plans, prices).
 * - Which nights changed, folded into date ranges, so only what changed is ever sent.
 * - How an OTA booking holds its rooms on /book until the owner edits that night in the sheet.
 */
import { BOOKING_ROOM_TYPES } from '../catalogue';
import { addDays, stayNights, type IsoDate } from '../dates';
import type { ClosureRow } from '../consoleClosures';
import type { SheetAvailability } from '../sheetAvailability';
import { CAMP, CAMP_PLANS, CAMP_TENTS, CAMP_UNIT_ID } from '@/data/shnonpedengCamp';
import { PROPERTY_ADDRESS } from '@/data/brandFacts';

export const HOSTEL_ID = 'XTSY-SHL-HOSTEL';
export const CAMP_ID = 'XTSY-SHN-CAMP';
/** Every property the console can connect. Adding one = one entry here plus its row in be_channel_properties. */
export const CHANNEL_PROPERTY_IDS = [HOSTEL_ID, CAMP_ID] as const;
export type ChannelPropertyId = (typeof CHANNEL_PROPERTY_IDS)[number];
export const isChannelPropertyId = (v: string): v is ChannelPropertyId => (CHANNEL_PROPERTY_IDS as readonly string[]).includes(v);

/** How far ahead counts and prices are sent (ZimmerStack accepts up to 500 nights). */
export const HORIZON_NIGHTS = 365;

export interface ChannelRoomType {
  /** XTSY's id; also the ZimmerStack `ref`, so a repeat save changes it instead of adding another. */
  ref: string;
  name: string;
  roomCount: number;
  adults: number;
  /** Room-only rate plan. */
  planRef: string;
  planName: string;
  /** Rupees, before GST. Sent as a string with two decimals (never a float). */
  rate: string;
}

export interface ChannelPropertySpec {
  id: ChannelPropertyId;
  name: string;
  address: { line1: string; city: string; state: string; country: 'IN' };
  roomTypes: ChannelRoomType[];
}

/** Whole paise → "1400.00": exact, no floating-point arithmetic. */
export const paiseToRupeeString = (paise: number) => `${Math.trunc(paise / 100)}.${String(Math.abs(paise % 100)).padStart(2, '0')}`;
const planRef = (ref: string) => `${ref}--room-only`;

export function channelProperty(id: ChannelPropertyId): ChannelPropertySpec {
  if (id === HOSTEL_ID) {
    return {
      id,
      name: 'XTSY Travellers Hostel',
      address: { line1: PROPERTY_ADDRESS, city: 'Shillong', state: 'Meghalaya', country: 'IN' },
      // Dorm beds are sold one bed per "room", as on the OTAs today.
      roomTypes: BOOKING_ROOM_TYPES.map((r) => ({
        ref: r.id, name: r.descriptor ? `${r.name} (${r.descriptor})` : r.name, roomCount: r.units, adults: r.maxGuestsPerUnit,
        planRef: planRef(r.id), planName: 'Room only', rate: paiseToRupeeString(r.rate),
      })),
    };
  }
  return {
    id,
    name: CAMP.name,
    address: { line1: CAMP.where, city: 'Shnonpedeng', state: 'Meghalaya', country: 'IN' },
    roomTypes: [{
      ref: CAMP_UNIT_ID, name: 'Riverside tent for two (camping and bonfire)', roomCount: CAMP_TENTS, adults: CAMP_PLANS.tent.guestsPer,
      planRef: planRef(CAMP_UNIT_ID), planName: 'Camping only', rate: paiseToRupeeString(CAMP_PLANS.tent.price * 100),
    }],
  };
}

/** The property a room type belongs to, or null for an unknown id. */
export function propertyOfRoomType(roomTypeId: string): ChannelPropertyId | null {
  for (const id of CHANNEL_PROPERTY_IDS) if (channelProperty(id).roomTypes.some((r) => r.ref === roomTypeId)) return id;
  return null;
}

export interface CountCell { roomTypeId: string; night: IsoDate; available: number }
export interface CountRange { roomTypeRef: string; dateFrom: IsoDate; dateTo: IsoDate; available: number }

/** Cells whose count differs from what was last sent (or were never sent). */
export function changedCounts(cells: CountCell[], sent: Map<string, number>): CountCell[] {
  return cells.filter((c) => sent.get(`${c.roomTypeId}|${c.night}`) !== c.available);
}

/** Consecutive nights of one room type with the same count become one range (dateTo inclusive). */
export function toRanges(cells: CountCell[]): CountRange[] {
  const sorted = [...cells].sort((a, b) => a.roomTypeId.localeCompare(b.roomTypeId) || a.night.localeCompare(b.night));
  const out: CountRange[] = [];
  for (const c of sorted) {
    const last = out[out.length - 1];
    if (last && last.roomTypeRef === c.roomTypeId && last.available === c.available && addDays(last.dateTo, 1) === c.night) last.dateTo = c.night;
    else out.push({ roomTypeRef: c.roomTypeId, dateFrom: c.night, dateTo: c.night, available: c.available });
  }
  return out;
}

/** Nights whose sheet count changed between two published snapshots (added or removed counts too). */
export function changedSheetNights(prev: SheetAvailability, next: SheetAvailability): { roomTypeId: string; night: IsoDate }[] {
  const out: { roomTypeId: string; night: IsoDate }[] = [];
  const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const id of ids) {
    const nights = new Set([...Object.keys(prev[id] ?? {}), ...Object.keys(next[id] ?? {})]);
    for (const night of nights) if (prev[id]?.[night] !== next[id]?.[night]) out.push({ roomTypeId: id, night });
  }
  return out.sort((a, b) => a.roomTypeId.localeCompare(b.roomTypeId) || a.night.localeCompare(b.night));
}

/** An OTA booking as stored in be_ota_bookings. */
export interface OtaBookingRow {
  status: 'CONFIRMED' | 'CANCELLED';
  check_in: IsoDate;
  check_out: IsoDate;
  rooms: { roomTypeId: string; units: number }[];
  sheet_at_arrival: Record<string, Record<string, number>>;
  received_at: string;
}

/**
 * Rooms an OTA booking holds on /book, as console-style block rows (one per night and room type).
 * A night stops being held once the owner has edited that night's count in the Google Sheet after
 * the booking arrived (the sheet then already counts it), when an "open" is saved in the console
 * after it, or when the booking is cancelled. Nights before `today` are left out.
 */
export function otaHolds(rows: OtaBookingRow[], sheetNow: SheetAvailability, today: IsoDate): ClosureRow[] {
  const out: ClosureRow[] = [];
  for (const b of rows) {
    if (b.status !== 'CONFIRMED') continue;
    for (const room of b.rooms ?? []) {
      if (!room.units || room.units < 1) continue;
      for (const night of stayNights(b.check_in, b.check_out)) {
        if (night < today) continue;
        const seen = b.sheet_at_arrival?.[room.roomTypeId]?.[night];
        const current = sheetNow[room.roomTypeId]?.[night];
        if (seen !== undefined && current !== undefined && seen !== current) continue; // owner already counted it
        out.push({ unit: room.roomTypeId, start: night, end: night, state: 'blocked', units: room.units, at: b.received_at });
      }
    }
  }
  return out;
}

/** The sheet counts for the nights a booking covers, kept with the booking when it arrives. */
export function sheetSnapshotFor(rooms: { roomTypeId: string }[], checkIn: IsoDate, checkOut: IsoDate, sheet: SheetAvailability): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of rooms) for (const night of stayNights(checkIn, checkOut)) {
    const v = sheet[r.roomTypeId]?.[night];
    if (v !== undefined) (out[r.roomTypeId] ??= {})[night] = v;
  }
  return out;
}
