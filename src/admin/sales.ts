/** Sales (WhatsApp enquiries → confirmed booking → payment record → invoice). Browser-safe and pure (tests/salesInvoice.test.ts). */
export type SalesMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other';
export const SALES_METHODS: { id: SalesMethod; label: string }[] = [
  { id: 'upi', label: 'UPI' }, { id: 'cash', label: 'Cash' }, { id: 'card', label: 'Card' }, { id: 'bank_transfer', label: 'Bank transfer' }, { id: 'other', label: 'Other' },
];
/** amount is what the guest pays for the line, GST included. gstRate (%) is used only when the property is GST registered. */
export interface FolioLine { description: string; amount: number; gstRate?: GstRate }
export const GST_RATES = [0, 5, 12, 18] as const;
export type GstRate = (typeof GST_RATES)[number];
export const DEFAULT_GST_RATE: GstRate = 5;

/** Splits each GST-inclusive line into taxable value, CGST and SGST (accommodation is supplied where the property is, so always intra-state). */
export function gstBreakdown(lines: FolioLine[]) {
  const rows = lines.map((l) => {
    const rate = (l.gstRate ?? 0) as number;
    const taxable = r2(l.amount / (1 + rate / 100));
    const tax = r2(l.amount - taxable);
    const cgst = r2(tax / 2);
    return { description: l.description, rate, amount: l.amount, taxable, cgst, sgst: r2(tax - cgst) };
  });
  const sum = (k: 'taxable' | 'cgst' | 'sgst') => r2(rows.reduce((a, x) => a + x[k], 0));
  return { rows, taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'), total: r2(rows.reduce((a, x) => a + x.amount, 0)) };
}
export interface SalesPayment { amount: number; method: SalesMethod; paidOn: string; note?: string }

const r2 = (n: number) => Math.round(n * 100) / 100;
export function folioTotals(lines: FolioLine[], payments: Pick<SalesPayment, 'amount'>[]) {
  const total = r2(lines.reduce((a, l) => a + l.amount, 0));
  const paid = r2(payments.reduce((a, p) => a + p.amount, 0));
  return { total, paid, balance: r2(total - paid) };
}

/** Why an invoice can't be issued yet, or null when it can. */
export function invoiceBlocker(i: { status: string; kind: string; payments: number; gstRegistered: boolean; hasInvoice: boolean; lines: FolioLine[] }): string | null {
  if (i.hasInvoice) return 'This booking already has an invoice.';
  if (i.kind !== 'stay' && i.kind !== 'camp') return 'Only stay and camp bookings get invoices here.';
  if (i.status !== 'confirmed') return 'Mark the enquiry confirmed first.';
  if (i.payments < 1) return 'Record at least one payment first.';
  if (i.gstRegistered && i.lines.some((l) => l.gstRate === undefined || !(GST_RATES as readonly number[]).includes(l.gstRate))) return 'Choose a GST rate for every line.';
  if (!i.lines.length || i.lines.some((l) => !l.description.trim() || !(l.amount > 0))) return 'Every folio line needs a description and an amount above zero.';
  return null;
}

export const propertyForKind = (kind: string) => (kind === 'camp' ? 'XTSY-SHN-CAMP' : 'XTSY-SHL-HOSTEL');
