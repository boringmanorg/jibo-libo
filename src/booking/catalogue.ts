/**
 * Room types the booking engine sells. Owner-confirmed 19 Nov 2026.
 * IDs are the room name in lowercase with hyphens, and map one-to-one to STAAH room codes.
 * Rates exclude breakfast, GST and payment gateway charges.
 */
import { rupees, type Paise } from './money';

export type SoldAs = 'bed' | 'room';

export interface BookingRoomType {
  id: string;
  name: string;
  /** Shown under the name; never part of the ID. */
  descriptor?: string;
  soldAs: SoldAs;
  /** Units sellable per night: beds for dorms, rooms otherwise. */
  units: number;
  /** Nightly rate per unit, before GST and gateway charges. */
  rate: Paise;
  /** Guests one unit can hold. */
  maxGuestsPerUnit: number;
  femaleOnly: boolean;
  /** Floor labels from the POS, where confirmed. */
  floorRooms?: string[];
  /** IDs the current website uses for the same room, so old links keep working. */
  legacyIds: string[];
}

const beds = (prefixes: string[]) => prefixes.flatMap((p) => ['A', 'B', 'C', 'D', 'E', 'F'].map((l) => `${p}${l}`));

export const BOOKING_ROOM_TYPES: readonly BookingRoomType[] = [
  {
    id: 'bed-in-8-bed-mixed-dormitory', name: 'Bed in 8 Bed Mixed Dormitory',
    soldAs: 'bed', units: 8, rate: rupees(400), maxGuestsPerUnit: 1, femaleOnly: false,
    floorRooms: ['8A', '8B', '8C', '8D', '8E', '8F', '8G', '8H'], legacyIds: ['8-bed-mixed-dorm'],
  },
  {
    id: 'bed-in-6-bed-standard-dormitory', name: 'Bed in 6 Bed Standard Dormitory', descriptor: 'Without lockers',
    soldAs: 'bed', units: 14, rate: rupees(450), maxGuestsPerUnit: 1, femaleOnly: false, legacyIds: [],
  },
  {
    id: 'bed-in-6-bed-mixed-dormitory', name: 'Bed in 6 Bed Mixed Dormitory',
    soldAs: 'bed', units: 18, rate: rupees(500), maxGuestsPerUnit: 1, femaleOnly: false,
    floorRooms: beds(['4', '5', '7']), legacyIds: ['6-bed-mixed-dorm'],
  },
  {
    id: 'bed-in-4-bed-female-deluxe-dormitory', name: 'Bed in 4 Bed Female Deluxe Dormitory',
    soldAs: 'bed', units: 2, rate: rupees(600), maxGuestsPerUnit: 1, femaleOnly: true, legacyIds: ['4-bed-female-only-dorm'],
  },
  {
    id: 'king-room-with-mountain-view', name: 'King Room with Mountain View',
    soldAs: 'room', units: 2, rate: rupees(2400), maxGuestsPerUnit: 2, femaleOnly: false, legacyIds: ['king-double-room'],
  },
  {
    id: 'triple-room-with-mountain-view', name: 'Triple Room with Mountain View',
    soldAs: 'room', units: 1, rate: rupees(3000), maxGuestsPerUnit: 3, femaleOnly: false, legacyIds: [],
  },
  {
    id: 'experience-by-xtsy', name: 'Experience by XTSY', descriptor: 'Premium Couple Ensuite',
    soldAs: 'room', units: 1, rate: rupees(4999), maxGuestsPerUnit: 2, femaleOnly: false,
    floorRooms: ['666'], legacyIds: ['xtsy-270'],
  },
] as const;

/** Breakfast from TAB Bistro, per person per morning, before GST. */
export const BREAKFAST_RATE: Paise = rupees(280);

export function findRoomType(id: string): BookingRoomType | undefined {
  return BOOKING_ROOM_TYPES.find((r) => r.id === id || r.legacyIds.includes(id));
}

/** "per bed" for dorms, "per room" otherwise: shown beside every price. */
export const unitLabel = (r: BookingRoomType): string => (r.soldAs === 'bed' ? 'per bed' : 'per room');
