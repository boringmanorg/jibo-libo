/**
 * GST slabs an admin picks from, per room type and add-on.
 * Hotel stays from 22 Sep 2025: 5% (no ITC) up to ₹7,500 per unit per night, 18% above.
 */
import { rupees, type Paise } from './money';

export type GstSlab = { kind: '5' } | { kind: '18' } | { kind: 'custom'; bps: number; note: string };

export const GST_SLAB_OPTIONS = [
  { value: '5', label: '5% — tariff up to ₹7,500 per unit per night (no input tax credit)' },
  { value: '18', label: '18% — tariff above ₹7,500 per unit per night (input tax credit available)' },
  { value: 'custom', label: 'Custom rate — on a change in law or your CA’s advice' },
] as const;

export const ACCOMMODATION_THRESHOLD: Paise = rupees(7500);

export function slabBps(slab: GstSlab): number {
  if (slab.kind === '5') return 500;
  if (slab.kind === '18') return 1800;
  if (!Number.isInteger(slab.bps) || slab.bps < 0 || slab.bps > 2800) throw new Error('Custom GST rate must be 0–28%');
  return slab.bps;
}

/** The slab the law suggests for an accommodation tariff (per unit per night, before GST). */
export const suggestAccommodationSlab = (tariff: Paise): GstSlab =>
  tariff <= ACCOMMODATION_THRESHOLD ? { kind: '5' } : { kind: '18' };

/** A warning when the chosen slab differs from the suggested one; null when they agree. */
export function slabMismatch(tariff: Paise, chosen: GstSlab): string | null {
  const suggested = suggestAccommodationSlab(tariff);
  if (chosen.kind === 'custom' || chosen.kind === suggested.kind) return null;
  return `A tariff of ₹${tariff / 100} per night usually takes ${suggested.kind}% GST, not ${chosen.kind}%.`;
}
