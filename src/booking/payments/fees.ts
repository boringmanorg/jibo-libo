/**
 * Gateway charges passed on to the guest (owner, 19 Nov 2026: added after GST, by payment method).
 *
 * With Zoho Payments this uses Zoho's own convenience-fee feature: the Zoho team switches it on,
 * Zoho adds the fee at checkout as its own line with 18% GST, for cards, net banking and UPI
 * (not bank transfers or recurring payments). The engine therefore sends Zoho the booking amount
 * only and shows this table's figures as the expected charge, so a guest is never charged twice.
 * Each charge is capped at Zoho's published platform fee for that method.
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

/** GST Zoho adds on a convenience fee. */
export const GST_ON_FEE_BPS = 1800;

/**
 * Zoho Payments India online platform fees, from zoho.com/in/payments/pricing (checked 25 Nov 2026):
 * UPI 0.5%; domestic cards, net banking and wallets 2.0%; international cards 3.0%; 18% GST on top.
 * (The 0.4%/0.9% debit and 1.99% credit figures on that page are in-person rates.)
 */
export const ZOHO_PLATFORM_FEE_BPS: Record<PaymentMethod, number> = {
  upi: 50, debit_card: 200, credit_card: 200, international_card: 300, net_banking: 200, wallet: 200,
};

/** Methods Zoho's convenience-fee feature can charge. */
export const ZOHO_CONVENIENCE_FEE_METHODS: ReadonlySet<PaymentMethod> = new Set(['upi', 'debit_card', 'credit_card', 'international_card', 'net_banking']);

export interface FeeRule { bps: number }
export type FeeTable = Record<PaymentMethod, FeeRule>;

/** Starts at Zoho's published fees; set each to what Zoho actually enables on your account. Wallets carry none. */
export const DEFAULT_FEE_TABLE: FeeTable = {
  upi: { bps: 50 }, debit_card: { bps: 200 }, credit_card: { bps: 200 },
  international_card: { bps: 300 }, net_banking: { bps: 200 }, wallet: { bps: 0 },
};

/** Problems with a fee table an admin wants to save; empty when it is acceptable. */
export function validateFeeTable(table: FeeTable): string[] {
  const problems: string[] = [];
  for (const { id, label } of PAYMENT_METHODS) {
    const rule = table[id];
    if (!rule || !Number.isInteger(rule.bps) || rule.bps < 0) {
      problems.push(`${label}: charge must be a whole number of basis points (100 = 1%).`);
      continue;
    }
    if (rule.bps > ZOHO_PLATFORM_FEE_BPS[id]) {
      problems.push(`${label}: ${rule.bps / 100}% is more than Zoho's fee of ${ZOHO_PLATFORM_FEE_BPS[id] / 100}%. A guest can be charged at most the actual cost.`);
    }
    if (rule.bps > 0 && !ZOHO_CONVENIENCE_FEE_METHODS.has(id)) {
      problems.push(`${label}: Zoho's convenience fee does not cover this method, so no charge can be added.`);
    }
  }
  return problems;
}

/** How each method is offered at the gateway's checkout. Card types cannot be told apart before payment. */
export const GATEWAY_METHOD: Record<PaymentMethod, 'card' | 'upi' | 'net_banking' | 'wallet'> = {
  upi: 'upi', debit_card: 'card', credit_card: 'card', international_card: 'card', net_banking: 'net_banking', wallet: 'wallet',
};
