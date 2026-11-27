/**
 * What Hostel POS (PMS by XTSY) pulls from this booking engine on each sync: the room types, the
 * physical rooms and beds behind each one, and how many are free each night. Browser-safe and pure
 * (pmsFeed.test.ts); the server route only adds the live counts.
 *
 * Everything here is already public on /book (names, rates, free counts). No guest data, no
 * bookings, no prices beyond the published rate.
 *
 * Ids are the engine's room-type ids, which are also the room-type refs sent to ZimmerStack, so
 * the PMS can keep one id per room type from the website through to the booking sites.
 */
import { BOOKING_ROOM_TYPES, type BookingRoomType } from './catalogue';
import { SHEET_ROOM_NUMBERS } from './sheetAvailability';
import type { IsoDate } from './dates';

export const PMS_FEED_VERSION = 1;
export const PMS_FEED_DAYS = 120;

export interface PmsFeedUnit {
  /** Bed or room label as on the floor: "8A", "666". */
  label: string;
  /** The room it is in: "Room 8", or the room number itself for a private room. */
  room: string;
}

export interface PmsFeedRoomType {
  id: string;
  name: string;
  descriptor?: string;
  soldAs: 'bed' | 'room';
  /** Beds or rooms sold per night. */
  units: number;
  /** Published nightly rate per unit, rupees before GST. */
  rate: number;
  maxGuests: number;
  femaleOnly: boolean;
  /** Order on the booking page. */
  order: number;
  unitsOnFloor: PmsFeedUnit[];
}

export interface PmsFeed {
  version: typeof PMS_FEED_VERSION;
  source: 'xtsy.one';
  generatedAt: string;
  from: IsoDate;
  days: number;
  roomTypes: PmsFeedRoomType[];
  /** Free beds or rooms per room type per night, after the sheet, console blocks, OTA and website bookings. */
  free: Record<string, Record<IsoDate, number>>;
}

const LETTERS = 'ABCDEFGHIJKL';

/**
 * The beds or rooms behind a room type. Floor labels from the POS when the catalogue has them;
 * otherwise from the sheet's room numbers: a private room is its room number, and dorm beds are
 * spread evenly over the type's rooms as 2A, 2B… (the owner renames them in Hostel POS if needed).
 */
export function unitsOnFloor(t: BookingRoomType): PmsFeedUnit[] {
  const rooms = Object.entries(SHEET_ROOM_NUMBERS)
    .filter(([, id]) => id === t.id)
    .map(([no]) => no)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (t.floorRooms?.length) {
    return t.floorRooms.map((label) => {
      if (t.soldAs === 'room') return { label, room: label };
      const roomNo = label.replace(/[A-Z]+$/i, '');
      return { label, room: `Room ${roomNo}` };
    });
  }
  if (t.soldAs === 'room') {
    const labels = rooms.length ? rooms : Array.from({ length: t.units }, (_, i) => `${t.id}-${i + 1}`);
    return labels.slice(0, t.units).map((label) => ({ label, room: label }));
  }
  const homes = rooms.length ? rooms : ['1'];
  const out: PmsFeedUnit[] = [];
  const per = Math.floor(t.units / homes.length);
  let extra = t.units % homes.length;
  for (const no of homes) {
    const n = per + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    for (let i = 0; i < n; i++) out.push({ label: `${no}${LETTERS[i] ?? String(i + 1)}`, room: `Room ${no}` });
  }
  return out;
}

export function feedRoomTypes(types: readonly BookingRoomType[] = BOOKING_ROOM_TYPES): PmsFeedRoomType[] {
  return types.map((t, i) => ({
    id: t.id,
    name: t.name,
    ...(t.descriptor ? { descriptor: t.descriptor } : {}),
    soldAs: t.soldAs,
    units: t.units,
    rate: Math.round(Number(t.rate) / 100),
    maxGuests: t.maxGuestsPerUnit,
    femaleOnly: t.femaleOnly,
    order: i + 1,
    unitsOnFloor: unitsOnFloor(t),
  }));
}
