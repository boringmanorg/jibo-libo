/**
 * Price build-up, in this order (owner, 19 Nov 2026):
 * room rates and add-ons → GST per line → gateway charge on the amount being paid now.
 */
import { BREAKFAST_RATE, findRoomType } from './catalogue';
import { stayNights, type IsoDate } from './dates';
import { applyBps, type Paise } from './money';
import { splitPayment } from './policy';
import { slabBps, suggestAccommodationSlab, type GstSlab } from './tax';
import { GST_ON_FEE_BPS, type FeeTable, type PaymentMethod } from './payments/fees';

export interface QuoteRequest {
  checkIn: IsoDate;
  checkOut: IsoDate;
  rooms: { roomTypeId: string; units: number; guests: number }[];
  /** Guests taking breakfast each morning; 0 for none. */
  breakfastGuests: number;
  /** Nightly rate per unit, when STAAH supplies one; otherwise the catalogue rate. */
  rateFor?: (roomTypeId: string, night: IsoDate) => Paise;
  gstSlabFor?: (roomTypeId: string) => GstSlab;
  breakfastGstSlab?: GstSlab;
}

export interface QuoteLine { label: string; taxable: Paise; gstBps: number; gst: Paise }

export interface Quote {
  nights: number;
  lines: QuoteLine[];
  taxable: Paise;
  gst: Paise;
  /** Rooms and add-ons with GST: the booking total before any gateway charge. */
  total: Paise;
  advance: Paise;
  balance: Paise;
}

export function quoteStay(req: QuoteRequest): Quote {
  const nights = stayNights(req.checkIn, req.checkOut);
  if (nights.length === 0) throw new Error('Check-out must be after check-in.');
  if (nights.length > 30) throw new Error('Stays longer than 30 nights are booked through the desk.');
  const lines: QuoteLine[] = [];

  for (const r of req.rooms) {
    const room = findRoomType(r.roomTypeId);
    if (!room) throw new Error(`Unknown room type: ${r.roomTypeId}`);
    if (!Number.isInteger(r.units) || r.units < 1) throw new Error('Choose at least one bed or room.');
    if (r.guests < 1 || r.guests > r.units * room.maxGuestsPerUnit) {
      throw new Error(`${room.name}: ${r.units} ${room.soldAs === 'bed' ? 'bed' : 'room'}(s) hold up to ${r.units * room.maxGuestsPerUnit} guest(s).`);
    }
    const nightly = nights.map((n) => req.rateFor?.(room.id, n) ?? room.rate);
    const taxable = nightly.reduce((s, rate) => s + rate * r.units, 0);
    // The slab follows the tariff per unit per night; the highest night decides when rates vary.
    const slab = req.gstSlabFor?.(room.id) ?? suggestAccommodationSlab(Math.max(...nightly));
    const gstBps = slabBps(slab);
    lines.push({ label: `${room.name} × ${r.units} × ${nights.length} night(s)`, taxable, gstBps, gst: applyBps(taxable, gstBps) });
  }

  if (req.breakfastGuests > 0) {
    const mornings = nights.length;
    const taxable = BREAKFAST_RATE * req.breakfastGuests * mornings;
    const gstBps = slabBps(req.breakfastGstSlab ?? { kind: '5' });
    lines.push({ label: `Breakfast × ${req.breakfastGuests} guest(s) × ${mornings} morning(s)`, taxable, gstBps, gst: applyBps(taxable, gstBps) });
  }

  const taxable = lines.reduce((s, l) => s + l.taxable, 0);
  const gst = lines.reduce((s, l) => s + l.gst, 0);
  const total = taxable + gst;
  return { nights: nights.length, lines, taxable, gst, total, ...splitPayment(total) };
}

/**
 * What the guest pays for one payment (advance or balance): the amount, the gateway charge for
 * the chosen method, and 18% GST on that charge. With Zoho's convenience fee switched on, Zoho
 * adds the charge at its checkout; this figure is what the guest is shown beforehand.
 */
export function chargeFor(amount: Paise, method: PaymentMethod, fees: FeeTable): { amount: Paise; gatewayCharge: Paise; gstOnCharge: Paise; payable: Paise } {
  const gatewayCharge = applyBps(amount, fees[method]?.bps ?? 0);
  const gstOnCharge = applyBps(gatewayCharge, GST_ON_FEE_BPS);
  return { amount, gatewayCharge, gstOnCharge, payable: amount + gatewayCharge + gstOnCharge };
}
