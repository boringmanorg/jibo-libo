import { describe, expect, it } from 'vitest';
import { guestKey, summarizeGuest, type FolioStay } from '@/admin/guestFolio';

const stay = (o: Partial<FolioStay>): FolioStay => ({ enquiryId: 'e', reference: 'XTSY-AAAAA', propertyId: 'XTSY-SHL-HOSTEL', checkIn: '2026-12-01', checkOut: '2026-12-02', guests: 1, status: 'confirmed', estimate: 0, invoice: null, paid: 0, ...o });
describe('guest folio', () => {
  it('matches the same guest whatever way the number was typed', () => { expect(guestKey('+91 88373 17070')).toBe(guestKey('8837317070')); });
  it('owes only what invoices bill, less payments against them', () => {
    const s = summarizeGuest('k', 'A', '1', [stay({ invoice: { id: 'i', number: 'n', total: 1200 }, paid: 500 }), stay({ checkIn: '2026-12-10', paid: 300 })]);
    expect(s).toMatchObject({ stays: 2, billed: 1200, paid: 800, balance: 700, lastStay: '2026-12-10' });
  });
});
