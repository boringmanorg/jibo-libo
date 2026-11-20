/**
 * Browser-only search and quote for /book while online booking is not live.
 * Same shapes as the live engine (searchStays / quoteCheckout) but from the static catalogue:
 * no database calls. Counts come from the console's blocks (passed in by the page loader); the desk
 * still confirms availability on WhatsApp.
 */
import type { BreakfastPick } from '@/data/breakfastMenu';
import { BOOKING_ROOM_TYPES } from './catalogue';
import { settingsFromRow } from './consoleSettings';
import { addDays, daysBetween, stayNights, todayInIndia, type IsoDate } from './dates';
import { chargeFor, quoteStay } from './pricing';
import type { PaymentMethod } from './payments/fees';
import type { SearchResult } from './publicEngine.core';
import { freeAfterClosures, type ClosureRow } from './consoleClosures';

const STRIP_NIGHTS = 7;

export function staticDateProblem(checkIn: string, checkOut: string, now = new Date()): string | null {
  const today = todayInIndia(now);
  if (daysBetween(today, checkIn) < 0) return 'Check-in cannot be in the past.';
  if (daysBetween(today, checkIn) > 365) return 'Bookings open up to one year ahead.';
  const n = daysBetween(checkIn, checkOut);
  if (n < 1) return 'Check-out must be after check-in.';
  if (n > 30) return 'Stays longer than 30 nights are booked through the desk.';
  return null;
}

export function staticSearch(checkIn: IsoDate, checkOut: IsoDate, photos: Record<string, { src: string; alt: string }[]> = {}, closures: ClosureRow[] = []): SearchResult {
  const nights = daysBetween(checkIn, checkOut);
  const rooms = BOOKING_ROOM_TYPES.map((r) => {
    // Room count less whatever the console has blocked; caps the +/− stepper and marks full nights.
    const free = (night: IsoDate) => freeAfterClosures(closures, r.id, night, r.units);
    const stay = stayNights(checkIn, checkOut).map(free);
    return {
      id: r.id, name: r.name, descriptor: r.descriptor, soldAs: r.soldAs, femaleOnly: r.femaleOnly, maxGuestsPerUnit: r.maxGuestsPerUnit,
      fromRate: r.rate,
      freeForStay: stay.length ? Math.min(...stay) : 0,
      totalUnits: r.units,
      strip: stayNights(checkIn, addDays(checkIn, STRIP_NIGHTS)).map((night) => { const f = free(night); return { night, free: f, rate: r.rate, closed: f === 0 }; }),
      photos: photos[r.id] ?? [],
    };
  });
  const open = rooms.filter((r) => r.freeForStay > 0);
  return { live: false, inventorySynced: false, checkIn, checkOut, nights, rooms, fromRate: open.length ? Math.min(...open.map((r) => r.fromRate)) : null };
}

/** Quote with the default console settings (owner's GST slabs and Zoho fee table). */
export function staticQuote(input: { checkIn: IsoDate; checkOut: IsoDate; rooms: { roomTypeId: string; units: number; guests: number }[]; breakfast: BreakfastPick[]; method: PaymentMethod }) {
  const settings = settingsFromRow(null);
  const quote = quoteStay({
    checkIn: input.checkIn, checkOut: input.checkOut, rooms: input.rooms, breakfast: input.breakfast,
    gstSlabFor: (id) => settings.gstSlabs[id], breakfastGstSlab: settings.breakfastGst,
  });
  return { quote, advanceCharge: chargeFor(quote.advance, input.method, settings.feeTable) };
}
