/**
 * Units free per night = capacity − confirmed − live holds, or zero on a blocked night.
 * `capacity` is the Google Sheet count after console blocks and OTA bookings (ZimmerStack);
 * `confirmed` is the website's own bookings.
 */
import { stayNights, type IsoDate } from './dates';

export interface Hold { roomTypeId: string; units: number; nights: IsoDate[]; expiresAt: Date }
export interface NightLoad { roomTypeId: string; night: IsoDate; units: number }

export interface AvailabilityInput {
  roomTypeId: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  /** Units per night, before website bookings and checkout holds. */
  capacity: (night: IsoDate) => number;
  confirmed: NightLoad[];
  holds: Hold[];
  blockedNights: Set<IsoDate>;
  now: Date;
}

export function freeUnitsPerNight(input: AvailabilityInput): { night: IsoDate; free: number }[] {
  return stayNights(input.checkIn, input.checkOut).map((night) => {
    if (input.blockedNights.has(night)) return { night, free: 0 };
    const booked = input.confirmed
      .filter((l) => l.roomTypeId === input.roomTypeId && l.night === night)
      .reduce((s, l) => s + l.units, 0);
    const held = input.holds
      .filter((h) => h.roomTypeId === input.roomTypeId && h.expiresAt > input.now && h.nights.includes(night))
      .reduce((s, h) => s + h.units, 0);
    return { night, free: Math.max(0, input.capacity(night) - booked - held) };
  });
}

/** Units sellable for the whole stay: the tightest night decides. */
export function freeUnitsForStay(input: AvailabilityInput): number {
  const nights = freeUnitsPerNight(input);
  return nights.length === 0 ? 0 : Math.min(...nights.map((n) => n.free));
}
