/**
 * Experience by XTSY and the shared enquiry quote.
 *
 * Room rates EXCLUDE GST from 20 Nov 2026 (owner): the nightly rate is the room price, and GST is
 * added on top at the hotel slab for that rate (5% up to ₹7,500 a night, 18% above). Breakfast from
 * TAB Bistro carries 5% GST; the decoration add-on stays at ₹2,500 + 18% GST, once per stay.
 * Rates come from the booking-engine catalogue through src/data/publicRates.ts.
 */
import { publicRate } from '@/data/publicRates';

export const PANORAMA_STAY_ONLY = publicRate('xtsy-270');
/* Breakfast is no longer a fixed per-person price: guests pick items from the TAB Bistro menu
   (src/data/breakfastMenu.ts), at menu prices plus 5% GST. */
const breakfastGst = (net: number) => Math.round((net * 5) / 100);

/** The name guests see for the glass suite. */
export const PANORAMA_DISPLAY_NAME = 'Experience by XTSY';

/**
 * Name to show guests for a room. The database still stores the glass suite as
 * "XTSY 270° Panorama Glass Ensuite" and booking quotes match on that, so keep using the stored
 * name for matching and pass it through here only when showing it.
 */
export function displayRoomName(name: string): string {
  return /panorama\s*glass\s*ensuite|270\s*°?\s*glass\s*suite/i.test(name) ? PANORAMA_DISPLAY_NAME : name;
}

/** The enquiry catalogue is static now, so the catalogue rate is the current rate. */
export function currentRoomRate(_roomId: string, basePrice: number): number {
  return Number(basePrice);
}
export const PANORAMA_DECORATION = 2500;
export const PANORAMA_DECORATION_GST = 450;

/** GST percentage for a room at this nightly rate (Indian hotel GST slabs used by XTSY). */
export const gstPercentFor = (nightlyRate: number) => (nightlyRate >= 7500 ? 18 : 5);

/** GST added on top of a room amount at its slab (integer rupees). */
export const gstOn = (amount: number, percent: number) => Math.round((amount * percent) / 100);

export interface QuoteLine { nightlyRate: number; quantity: number }

/**
 * subtotal = rooms + decoration + breakfast before GST; taxes = GST on each of them;
 * total = what the guest pays (before any payment gateway charge).
 */
export function quoteStay(lines: QuoteLine[], nights: number, decoration = false, breakfastAmount = 0) {
  let roomsNet = 0;
  let roomsGst = 0;
  for (const l of lines) {
    const net = l.nightlyRate * l.quantity * nights;
    roomsNet += net;
    roomsGst += gstOn(net, gstPercentFor(l.nightlyRate));
  }
  const decorationNet = decoration ? PANORAMA_DECORATION : 0;
  const decorationGst = decoration ? PANORAMA_DECORATION_GST : 0;
  return {
    roomsNet,
    roomsGst,
    decorationNet,
    decorationGst,
    breakfastAmount,
    breakfastGst: breakfastGst(breakfastAmount),
    subtotal: roomsNet + decorationNet + breakfastAmount,
    taxes: roomsGst + decorationGst + breakfastGst(breakfastAmount),
    total: roomsNet + roomsGst + decorationNet + decorationGst + breakfastAmount + breakfastGst(breakfastAmount),
  };
}

/** Experience by XTSY quote (stay only; decoration optional). */
export function panoramaQuote(nights: number, decoration: boolean) {
  const q = quoteStay([{ nightlyRate: PANORAMA_STAY_ONLY, quantity: 1 }], nights, decoration);
  return { nightly: PANORAMA_STAY_ONLY, ...q };
}
