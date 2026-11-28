/** Invoice numbering: one unbroken series per financial year (April–March, India) and document kind. */
import type { IsoDate } from './dates';

export type InvoiceKind = 'advance_receipt' | 'tax_invoice' | 'business_invoice';
const CODE: Record<InvoiceKind, string> = { advance_receipt: 'AR', tax_invoice: 'TI', business_invoice: 'BI' };

/** '2026-27' for any date from 1 Apr 2026 to 31 Mar 2027. */
export function financialYear(d: IsoDate): string {
  const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** XTSY/2026-27/TI/0001 */
export const invoiceNumber = (kind: InvoiceKind, fy: string, seq: number): string =>
  `XTSY/${fy}/${CODE[kind]}/${String(seq).padStart(4, '0')}`;
