/** Guest Folio: one record per guest (matched on the last 10 digits of their WhatsApp number) per property. Pure (tests/guestFolio.test.ts). */
export const guestKey = (phone: string) => phone.replace(/\D/g, '').slice(-10);

export interface FolioStay { enquiryId: string; reference: string; propertyId: string; checkIn: string; checkOut: string; guests: number; status: string; estimate: number; invoice: { id: string; number: string; total: number } | null; paid: number }
export interface GuestFolioSummary { key: string; name: string; phone: string; propertyIds: string[]; stays: number; lastStay: string; billed: number; paid: number; balance: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Billed = invoice totals; for a stay without an invoice, nothing is billed yet (quotes are not debts). */
export function summarizeGuest(key: string, name: string, phone: string, stays: FolioStay[]): GuestFolioSummary {
  const billed = r2(stays.reduce((a, s) => a + (s.invoice?.total ?? 0), 0));
  const paid = r2(stays.reduce((a, s) => a + s.paid, 0));
  return {
    key, name, phone, propertyIds: [...new Set(stays.map((s) => s.propertyId))].sort(), stays: stays.length,
    lastStay: stays.map((s) => s.checkIn).sort().at(-1) ?? '', billed, paid, balance: r2(billed - stays.reduce((a, s) => a + (s.invoice ? s.paid : 0), 0)),
  };
}
