import { describe, expect, it } from 'vitest';
import { folioTotals, gstBreakdown, invoiceBlocker } from '@/admin/sales';

const ok = { status: 'confirmed', kind: 'stay', payments: 1, gstRegistered: false, hasInvoice: false, lines: [{ description: 'Dorm bed, 2 nights', amount: 1050 }] };
describe('sales invoices', () => {
  it('works out the balance from folio lines and payments', () => {
    expect(folioTotals([{ description: 'a', amount: 1050 }, { description: 'Late check-out', amount: 200 }], [{ amount: 262.5 }])).toEqual({ total: 1250, paid: 262.5, balance: 987.5 });
  });
  it('issues only after the booking is confirmed', () => { expect(invoiceBlocker({ ...ok, status: 'contacted' })).toMatch(/confirmed/); });
  it('issues only after a payment is recorded', () => { expect(invoiceBlocker({ ...ok, payments: 0 })).toMatch(/payment/); });
  it('never issues twice', () => { expect(invoiceBlocker({ ...ok, hasInvoice: true })).toMatch(/already/); });
  it('allows a confirmed, paid booking', () => { expect(invoiceBlocker(ok)).toBeNull(); });
  it('a GST-registered property needs a GST rate on every line', () => {
    expect(invoiceBlocker({ ...ok, gstRegistered: true })).toMatch(/GST rate/);
    expect(invoiceBlocker({ ...ok, gstRegistered: true, lines: [{ description: 'Room', amount: 1050, gstRate: 5 }] })).toBeNull();
  });
  it('splits a GST-inclusive amount into taxable value, CGST and SGST', () => {
    expect(gstBreakdown([{ description: 'Room', amount: 1050, gstRate: 5 }, { description: 'Dorm', amount: 399, gstRate: 0 }])).toMatchObject({ taxable: 1399, cgst: 25, sgst: 25, total: 1449 });
  });
});

import { checkOutProblem } from '@/checkin/checkInModel';
describe('self check-in check-out time', () => {
  const base = { checkInDate: '2026-12-01', checkInTime: '14:00', checkOutDate: '2026-12-03' };
  it('allows 11:30 AM', () => { expect(checkOutProblem({ ...base, checkOutTime: '11:30' })).toBeNull(); });
  it('refuses later than 11:30 AM', () => { expect(checkOutProblem({ ...base, checkOutTime: '11:31' })).toMatch(/11:30/); });
});
