/**
 * Gateway charges passed on to the guest, set per payment method by an admin.
 * Owner, 19 Nov 2026: charges are added after GST, depending on how the guest pays.
 * Default allows a charge only on credit and international cards: surcharges on debit and
 * prepaid cards are not permitted, UPI carries zero MDR, and any charge must be shown
 * separately and not exceed the gateway's actual cost.
 */
export type PaymentMethod = 'upi' | 'debit_card' | 'credit_card' | 'international_card' | 'net_banking' | 'wallet';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'upi', label: 'UPI' },
  { id: 'debit_card', label: 'Debit card' },
  { id: 'credit_card', label: 'Credit card' },
  { id: 'international_card', label: 'International card' },
  { id: 'net_banking', label: 'Net banking' },
  { id: 'wallet', label: 'Wallet' },
];

/** Methods where passing on the charge is allowed without a written override. */
export const PASS_THROUGH_ALLOWED: ReadonlySet<PaymentMethod> = new Set(['credit_card', 'international_card']);

export interface FeeRule { bps: number; override?: { reason: string } }
export type FeeTable = Record<PaymentMethod, FeeRule>;

export const DEFAULT_FEE_TABLE: FeeTable = {
  upi: { bps: 0 }, debit_card: { bps: 0 }, credit_card: { bps: 0 },
  international_card: { bps: 0 }, net_banking: { bps: 0 }, wallet: { bps: 0 },
};

/** Problems with a fee table an admin wants to save; empty when it is acceptable. */
export function validateFeeTable(table: FeeTable): string[] {
  const problems: string[] = [];
  for (const { id, label } of PAYMENT_METHODS) {
    const rule = table[id];
    if (!rule || !Number.isInteger(rule.bps) || rule.bps < 0 || rule.bps > 500) {
      problems.push(`${label}: charge must be a whole number of basis points between 0 and 500 (0–5%).`);
      continue;
    }
    if (rule.bps > 0 && !PASS_THROUGH_ALLOWED.has(id) && !rule.override?.reason?.trim()) {
      problems.push(`${label}: passing on a charge here needs a written reason (for example, your gateway's or CA's confirmation).`);
    }
  }
  return problems;
}

/** How each method is offered at the gateway's checkout. Card types cannot be told apart before payment. */
export const GATEWAY_METHOD: Record<PaymentMethod, 'card' | 'upi' | 'netbanking' | 'wallet'> = {
  upi: 'upi', debit_card: 'card', credit_card: 'card', international_card: 'card', net_banking: 'netbanking', wallet: 'wallet',
};
