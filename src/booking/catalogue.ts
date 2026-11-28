/**
 * Room types the booking engine sells. Owner-confirmed 19 Nov 2026.
 * IDs are the room name in lowercase with hyphens, and are the room-type refs sent to ZimmerStack.
 * Rates exclude breakfast, GST and payment gateway charges.
 */
import type { Paise } from './money';

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
}

export { HOSTEL_ROOM_TYPES as BOOKING_ROOM_TYPES } from '@/properties/xtsyHostel';
import { HOSTEL_ROOM_TYPES as BOOKING_ROOM_TYPES } from '@/properties/xtsyHostel';

/* Breakfast is chosen item by item from the TAB Bistro menu: see src/data/breakfastMenu.ts. */

export function findRoomType(id: string): BookingRoomType | undefined {
  return BOOKING_ROOM_TYPES.find((r) => r.id === id);
}

/** "per bed" for dorms, "per room" otherwise: shown beside every price. */
export const unitLabel = (r: BookingRoomType): string => (r.soldAs === 'bed' ? 'per bed' : 'per room');
