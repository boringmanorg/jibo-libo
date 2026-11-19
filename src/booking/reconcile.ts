/**
 * Night audit: matches payments to bookings and lists what needs a human.
 * Pure: the console loads the rows and passes them in.
 */
import { daysBetween, type IsoDate } from './dates';

export interface AuditBooking {
  id: string; reference: string; status: string; check_in: IsoDate; check_out: IsoDate;
  advance_paise: number; balance_paise: number; channel_status: string;
}
export interface AuditPayment {
  id: string; booking_id: string; kind: 'advance' | 'balance' | 'refund'; status: string;
  amount_paise: number; method_declared: string | null; method_actual: string | null;
  settled_paise: number | null; created_at: string;
}

export type IssueCode =
  | 'paid_not_confirmed' | 'confirmed_without_advance' | 'advance_amount_mismatch' | 'method_mismatch'
  | 'not_settled' | 'channel_not_synced' | 'balance_unpaid_after_checkout';

export interface AuditIssue { code: IssueCode; reference: string; detail: string; severity: 'high' | 'medium' }

const CONFIRMED = new Set(['confirmed', 'checked_in', 'settled']);
const rupee = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function nightAudit(bookings: AuditBooking[], payments: AuditPayment[], today: IsoDate): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const byBooking = new Map<string, AuditPayment[]>();
  for (const p of payments) byBooking.set(p.booking_id, [...(byBooking.get(p.booking_id) ?? []), p]);

  for (const b of bookings) {
    const pays = byBooking.get(b.id) ?? [];
    const advance = pays.filter((p) => p.kind === 'advance' && p.status === 'succeeded');
    const paidAdvance = advance.reduce((s, p) => s + p.amount_paise, 0);
    const paidBalance = pays.filter((p) => p.kind === 'balance' && p.status === 'succeeded').reduce((s, p) => s + p.amount_paise, 0);

    if (advance.length && !CONFIRMED.has(b.status) && !b.status.startsWith('cancelled')) {
      issues.push({ code: 'paid_not_confirmed', reference: b.reference, severity: 'high', detail: `Advance of ${rupee(paidAdvance)} received but the booking is "${b.status}".` });
    }
    if (CONFIRMED.has(b.status) && advance.length === 0) {
      issues.push({ code: 'confirmed_without_advance', reference: b.reference, severity: 'high', detail: 'Confirmed with no successful advance payment on record.' });
    }
    if (advance.length && paidAdvance !== b.advance_paise) {
      issues.push({ code: 'advance_amount_mismatch', reference: b.reference, severity: 'high', detail: `Advance due ${rupee(b.advance_paise)}, received ${rupee(paidAdvance)}.` });
    }
    for (const p of pays) {
      if (p.status === 'succeeded' && p.method_declared && p.method_actual && p.method_declared !== p.method_actual) {
        issues.push({ code: 'method_mismatch', reference: b.reference, severity: 'medium', detail: `Guest chose ${p.method_declared} but paid by ${p.method_actual}; check the gateway charge.` });
      }
      if (p.status === 'succeeded' && p.settled_paise === null && daysBetween(p.created_at.slice(0, 10), today) > 3) {
        issues.push({ code: 'not_settled', reference: b.reference, severity: 'medium', detail: `${rupee(p.amount_paise)} paid on ${p.created_at.slice(0, 10)} has not been settled to the bank.` });
      }
    }
    if (CONFIRMED.has(b.status) && b.channel_status !== 'synced' && b.channel_status !== 'not_required') {
      issues.push({ code: 'channel_not_synced', reference: b.reference, severity: 'high', detail: `Not confirmed by STAAH (${b.channel_status}); OTAs may still sell these nights.` });
    }
    if (CONFIRMED.has(b.status) && daysBetween(b.check_out, today) >= 0 && paidBalance < b.balance_paise) {
      issues.push({ code: 'balance_unpaid_after_checkout', reference: b.reference, severity: 'high', detail: `Checked out on ${b.check_out} with ${rupee(b.balance_paise - paidBalance)} of the balance unpaid.` });
    }
  }
  return issues.sort((a, b) => (a.severity === b.severity ? a.reference.localeCompare(b.reference) : a.severity === 'high' ? -1 : 1));
}
