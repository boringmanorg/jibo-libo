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
import { sheetCapacity, type SheetAvailability } from './sheetAvailability';
import { nearestOpenStays } from './nearestDates';
import { smartRate, type SmartRule } from './smartPricing';

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

export function staticSearch(checkIn: IsoDate, checkOut: IsoDate, photos: Record<string, { src: string; alt: string }[]> = {}, closures: ClosureRow[] = [], sheet: SheetAvailability = {}, now = new Date(), pricing: SmartRule[] = []): SearchResult {
  const today = todayInIndia(now);
  const nights = daysBetween(checkIn, checkOut);
  const rooms = BOOKING_ROOM_TYPES.map((r) => {
    // The Google Sheet's count for the night (else the full room count), less console blocks;
    // caps the +/− stepper and marks full nights.
    const free = (night: IsoDate) => freeAfterClosures(closures, r.id, night, sheetCapacity(sheet, r.id, night, r.units));
    const stay = stayNights(checkIn, checkOut).map(free);
    const rule = pricing.find((p) => p.roomTypeId === r.id);
    const rateOn = (night: IsoDate, f: number) => smartRate(r.rate, rule, f, r.units, night, today);
    const stayRates = stayNights(checkIn, checkOut).map((n, i) => rateOn(n, stay[i] ?? 0));
    return {
      id: r.id, name: r.name, descriptor: r.descriptor, soldAs: r.soldAs, femaleOnly: r.femaleOnly, maxGuestsPerUnit: r.maxGuestsPerUnit,
      fromRate: stayRates.length ? Math.min(...stayRates) : r.rate,
      freeForStay: stay.length ? Math.min(...stay) : 0,
      totalUnits: r.units,
      strip: stayNights(checkIn, addDays(checkIn, STRIP_NIGHTS)).map((night) => { const f = free(night); return { night, free: f, rate: rateOn(night, f), closed: f === 0 }; }),
      photos: photos[r.id] ?? [],
    };
  });
  const open = rooms.filter((r) => r.freeForStay > 0);
  // Full: the closest stays of the same length that have space (same counts as above).
  const suggestions = open.length ? undefined : nearestOpenStays(checkIn, nights, todayInIndia(now), 365, (ci, co) => {
    const rates = BOOKING_ROOM_TYPES.filter((r) => stayNights(ci, co).every((n) => freeAfterClosures(closures, r.id, n, sheetCapacity(sheet, r.id, n, r.units)) > 0)).map((r) => r.rate);
    return rates.length ? Math.min(...rates) : null;
  });
  return { live: false, inventorySynced: false, checkIn, checkOut, nights, rooms, fromRate: open.length ? Math.min(...open.map((r) => r.fromRate)) : null, ...(suggestions ? { suggestions } : {}) };
}

/** Quote with the default console settings (owner's GST slabs and Zoho fee table). */
export function staticQuote(input: { checkIn: IsoDate; checkOut: IsoDate; rooms: { roomTypeId: string; units: number; guests: number }[]; breakfast: BreakfastPick[]; method: PaymentMethod }, opts: { closures?: ClosureRow[]; sheet?: SheetAvailability; pricing?: SmartRule[]; now?: Date } = {}) {
  const settings = settingsFromRow(null);
  const today = todayInIndia(opts.now ?? new Date());
  const rateFor = opts.pricing?.length ? (id: string, night: IsoDate) => {
    const r = BOOKING_ROOM_TYPES.find((x) => x.id === id);
    if (!r) return 0;
    const f = freeAfterClosures(opts.closures ?? [], r.id, night, sheetCapacity(opts.sheet ?? {}, r.id, night, r.units));
    return smartRate(r.rate, opts.pricing?.find((p) => p.roomTypeId === id), f, r.units, night, today);
  } : undefined;
  const quote = quoteStay({
    rateFor: rateFor as never,
    checkIn: input.checkIn, checkOut: input.checkOut, rooms: input.rooms, breakfast: input.breakfast,
    gstSlabFor: (id) => settings.gstSlabs[id], breakfastGstSlab: settings.breakfastGst,
  });
  return { quote, advanceCharge: chargeFor(quote.advance, input.method, settings.feeTable) };
}
