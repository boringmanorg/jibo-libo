/** Console settings for the booking engine: what the admin edits, and what is refused or flagged. */
import { z } from 'zod';
import { BOOKING_ROOM_TYPES } from './catalogue';
import { DEFAULT_FEE_TABLE, PAYMENT_METHODS, validateFeeTable, type FeeTable, type PaymentMethod } from './payments/fees';
import { slabMismatch, suggestAccommodationSlab, type GstSlab } from './tax';

const slab = z.union([
  z.object({ kind: z.literal('5') }),
  z.object({ kind: z.literal('18') }),
  z.object({ kind: z.literal('custom'), bps: z.number().int().min(0).max(2800), note: z.string().trim().min(3).max(200) }),
]);
const feeRule = z.object({ bps: z.number() });

export const settingsInput = z.object({
  activeGateway: z.enum(['zoho', 'razorpay']),
  holdMinutes: z.number().int().min(5).max(15),
  feeTable: z.object(Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, feeRule])) as Record<PaymentMethod, typeof feeRule>),
  gstSlabs: z.record(z.string(), slab),
  breakfastGst: slab,
});
export type SettingsInput = z.infer<typeof settingsInput>;

export interface BookingSettings extends SettingsInput { engineSwitchedOn: boolean; policyVersion: string }

/** Settings with every room type given a slab (the suggested one when none is saved). */
export function settingsFromRow(row: Record<string, any> | null): BookingSettings {
  const saved = (row?.gst_slabs ?? {}) as Record<string, GstSlab>;
  const gstSlabs = Object.fromEntries(BOOKING_ROOM_TYPES.map((r) => [r.id, saved[r.id] ?? suggestAccommodationSlab(r.rate)]));
  return {
    engineSwitchedOn: Boolean(row?.engine_switched_on),
    activeGateway: row?.active_gateway === 'razorpay' ? 'razorpay' : 'zoho',
    holdMinutes: Number(row?.hold_minutes ?? 15),
    feeTable: { ...DEFAULT_FEE_TABLE, ...((row?.fee_table ?? {}) as Partial<FeeTable>) },
    gstSlabs,
    breakfastGst: (row?.breakfast_gst as GstSlab) ?? { kind: '5' },
    policyVersion: String(row?.policy_version ?? '2026-11-19'),
  };
}

/** Problems block saving; warnings are shown but allowed. */
export function reviewSettings(input: SettingsInput): { problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const parsed = settingsInput.safeParse(input);
  if (!parsed.success) problems.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  problems.push(...validateFeeTable(input.feeTable as FeeTable));
  if (input.activeGateway === 'razorpay') problems.push('Razorpay is not connected yet; keep Zoho Payments active.');
  const unknown = Object.keys(input.gstSlabs).filter((id) => !BOOKING_ROOM_TYPES.some((r) => r.id === id));
  if (unknown.length) problems.push(`Unknown room types: ${unknown.join(', ')}`);
  const warnings = BOOKING_ROOM_TYPES.flatMap((r) => {
    const s = input.gstSlabs[r.id];
    const w = s ? slabMismatch(r.rate, s) : null;
    return w ? [`${r.name}: ${w}`] : [];
  });
  return { problems, warnings };
}
