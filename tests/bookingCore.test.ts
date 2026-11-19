import { describe, expect, it } from 'vitest';
import { BOOKING_ROOM_TYPES, findRoomType, unitLabel } from '@/booking/catalogue';
import { isIsoDate, stayNights, todayInIndia } from '@/booking/dates';
import { rupees } from '@/booking/money';
import { canChangeDates, lastChangeDate, refundOnCancel, splitPayment } from '@/booking/policy';
import { chargeFor, quoteStay } from '@/booking/pricing';
import { slabMismatch, suggestAccommodationSlab } from '@/booking/tax';
import { DEFAULT_FEE_TABLE, validateFeeTable, type FeeTable } from '@/booking/payments/fees';
import { freeUnitsForStay, freeUnitsPerNight } from '@/booking/availability';

const at = (iso: string) => new Date(iso);

describe('room catalogue (owner, 19 Nov 2026)', () => {
  it('sells exactly the seven confirmed room types, with their units and rates before GST', () => {
    expect(BOOKING_ROOM_TYPES.map((r) => [r.id, r.units, r.rate / 100])).toEqual([
      ['bed-in-8-bed-mixed-dormitory', 8, 400],
      ['bed-in-6-bed-standard-dormitory', 14, 450],
      ['bed-in-6-bed-mixed-dormitory', 18, 500],
      ['bed-in-4-bed-female-deluxe-dormitory', 2, 600],
      ['king-room-with-mountain-view', 2, 2400],
      ['triple-room-with-mountain-view', 1, 3000],
      ['experience-by-xtsy', 1, 4999],
    ]);
  });

  it('derives every ID from the room name, lowercase with hyphens', () => {
    for (const r of BOOKING_ROOM_TYPES) expect(r.id).toBe(r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  });

  it('knows rooms only by their new IDs; the old site IDs, including xtsy-270, are gone', () => {
    expect(findRoomType('experience-by-xtsy')?.name).toBe('Experience by XTSY');
    for (const old of ['xtsy-270', '6-bed-mixed-dorm', '8-bed-mixed-dorm', '4-bed-female-only-dorm', 'king-double-room', 'nope']) {
      expect(findRoomType(old)).toBeUndefined();
    }
  });

  it('labels dorm prices per bed and rooms per room', () => {
    expect(unitLabel(findRoomType('bed-in-8-bed-mixed-dormitory')!)).toBe('per bed');
    expect(unitLabel(findRoomType('experience-by-xtsy')!)).toBe('per room');
  });

  it('marks only the female deluxe dorm as female-only, with 18 mixed beds on 4A–7F', () => {
    expect(BOOKING_ROOM_TYPES.filter((r) => r.femaleOnly).map((r) => r.id)).toEqual(['bed-in-4-bed-female-deluxe-dormitory']);
    expect(findRoomType('bed-in-6-bed-mixed-dormitory')!.floorRooms).toHaveLength(18);
  });
});

describe('dates', () => {
  it('lists the nights of a stay, not the check-out day', () => {
    expect(stayNights('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
  });
  it('rejects impossible dates', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
  });
  it('uses India time: 19:00 UTC is already the next day', () => {
    expect(todayInIndia(at('2026-11-19T19:00:00Z'))).toBe('2026-11-20');
  });
});

describe('date-change policy: one change, at least 14 days before check-in', () => {
  const booking = { status: 'confirmed' as const, checkIn: '2026-12-03', dateChangesUsed: 0 };

  it('allows a change exactly 14 days before check-in', () => {
    expect(canChangeDates(booking, at('2026-11-19T06:00:00Z'))).toEqual({ allowed: true });
  });
  it('refuses it 13 days before, counting the day in India', () => {
    expect(canChangeDates(booking, at('2026-11-19T19:00:00Z')).allowed).toBe(false);
  });
  it('refuses a second change', () => {
    expect(canChangeDates({ ...booking, dateChangesUsed: 1 }, at('2026-11-01T06:00:00Z')).allowed).toBe(false);
  });
  it('never allows a change on a last-minute booking', () => {
    const lastMinute = { ...booking, checkIn: '2026-11-25' };
    expect(canChangeDates(lastMinute, at('2026-11-19T06:00:00Z')).allowed).toBe(false);
    expect(lastChangeDate(lastMinute, at('2026-11-19T06:00:00Z'))).toBeNull();
  });
  it('tells the guest the last day to ask', () => {
    expect(lastChangeDate(booking, at('2026-11-10T06:00:00Z'))).toBe('2026-11-19');
  });
  it('only changes confirmed bookings', () => {
    expect(canChangeDates({ ...booking, status: 'held' }, at('2026-11-01T06:00:00Z')).allowed).toBe(false);
  });
});

describe('cancellation and payment split', () => {
  it('never refunds a guest cancellation; refunds everything when XTSY cancels', () => {
    expect(refundOnCancel('guest', rupees(5000))).toBe(0);
    expect(refundOnCancel('xtsy', rupees(5000))).toBe(rupees(5000));
  });
  it('takes 25% now and 75% at check-in, adding up to the paisa', () => {
    for (const total of [rupees(2100), 524895, 1, 333333]) {
      const { advance, balance } = splitPayment(total);
      expect(advance + balance).toBe(total);
      expect(Math.abs(advance - total / 4)).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('pricing: rates, then GST, then the gateway charge', () => {
  it('prices two dorm beds for two nights at 5% GST', () => {
    const q = quoteStay({ checkIn: '2026-12-01', checkOut: '2026-12-03', rooms: [{ roomTypeId: 'bed-in-6-bed-mixed-dormitory', units: 2, guests: 2 }], breakfastGuests: 0 });
    expect([q.taxable, q.gst, q.total, q.advance, q.balance]).toEqual([rupees(2000), rupees(100), rupees(2100), rupees(525), rupees(1575)]);
  });
  it('prices the suite to the paisa', () => {
    const q = quoteStay({ checkIn: '2026-12-01', checkOut: '2026-12-02', rooms: [{ roomTypeId: 'experience-by-xtsy', units: 1, guests: 2 }], breakfastGuests: 0 });
    expect([q.taxable, q.gst, q.total]).toEqual([499900, 24995, 524895]);
  });
  it('adds breakfast at ₹280 per person per morning plus GST', () => {
    const q = quoteStay({ checkIn: '2026-12-01', checkOut: '2026-12-03', rooms: [{ roomTypeId: 'king-room-with-mountain-view', units: 1, guests: 2 }], breakfastGuests: 2 });
    const bf = q.lines.find((l) => l.label.startsWith('Breakfast'))!;
    expect([bf.taxable, bf.gst]).toEqual([rupees(1120), rupees(56)]);
  });
  it('refuses more guests than the beds or rooms hold', () => {
    expect(() => quoteStay({ checkIn: '2026-12-01', checkOut: '2026-12-02', rooms: [{ roomTypeId: 'bed-in-8-bed-mixed-dormitory', units: 2, guests: 3 }], breakfastGuests: 0 })).toThrow(/hold up to 2/);
  });
  it('refuses empty and over-long stays', () => {
    const rooms = [{ roomTypeId: 'experience-by-xtsy', units: 1, guests: 1 }];
    expect(() => quoteStay({ checkIn: '2026-12-02', checkOut: '2026-12-02', rooms, breakfastGuests: 0 })).toThrow();
    expect(() => quoteStay({ checkIn: '2026-12-01', checkOut: '2027-01-15', rooms, breakfastGuests: 0 })).toThrow(/30 nights/);
  });
  it('adds the charge for the method the guest picks, plus 18% GST on that charge', () => {
    // ₹525 advance by credit card at 1.99%: ₹10.45 charge, ₹1.88 GST on it.
    expect(chargeFor(rupees(525), 'credit_card', DEFAULT_FEE_TABLE)).toEqual({ amount: 52500, gatewayCharge: 1045, gstOnCharge: 188, payable: 53733 });
    // UPI at 0.5%: ₹2.63 charge, ₹0.47 GST.
    expect(chargeFor(rupees(525), 'upi', DEFAULT_FEE_TABLE)).toMatchObject({ gatewayCharge: 263, gstOnCharge: 47 });
    expect(chargeFor(rupees(525), 'wallet', DEFAULT_FEE_TABLE).payable).toBe(52500);
  });
});

describe('GST slab selection', () => {
  it('suggests 5% up to ₹7,500 a night and 18% above', () => {
    expect(suggestAccommodationSlab(rupees(7500)).kind).toBe('5');
    expect(suggestAccommodationSlab(rupees(7501)).kind).toBe('18');
  });
  it('warns when an admin picks a slab that does not match the tariff', () => {
    expect(slabMismatch(rupees(4999), { kind: '18' })).toMatch(/usually takes 5%/);
    expect(slabMismatch(rupees(4999), { kind: '5' })).toBeNull();
  });
});

describe('gateway charge table (Zoho convenience fee)', () => {
  it('starts at Zoho\'s published fees, including 0.5% on UPI, with nothing on wallets', () => {
    expect(Object.fromEntries(Object.entries(DEFAULT_FEE_TABLE).map(([k, v]) => [k, v.bps]))).toEqual({
      upi: 50, debit_card: 90, credit_card: 199, international_card: 300, net_banking: 200, wallet: 0,
    });
    expect(validateFeeTable(DEFAULT_FEE_TABLE)).toEqual([]);
  });
  it('allows passing on charges for UPI, cards and net banking', () => {
    const table: FeeTable = { ...DEFAULT_FEE_TABLE, upi: { bps: 50 }, debit_card: { bps: 40 } };
    expect(validateFeeTable(table)).toEqual([]);
  });
  it('never charges a guest more than Zoho\'s own fee', () => {
    expect(validateFeeTable({ ...DEFAULT_FEE_TABLE, upi: { bps: 60 } })[0]).toMatch(/more than Zoho's fee of 0.5%/);
    expect(validateFeeTable({ ...DEFAULT_FEE_TABLE, credit_card: { bps: 250 } })).toHaveLength(1);
  });
  it('refuses a charge on wallets, which Zoho\'s convenience fee does not cover', () => {
    expect(validateFeeTable({ ...DEFAULT_FEE_TABLE, wallet: { bps: 100 } })[0]).toMatch(/does not cover/);
  });
  it('refuses fractional or negative rates', () => {
    expect(validateFeeTable({ ...DEFAULT_FEE_TABLE, upi: { bps: 12.5 } })).toHaveLength(1);
    expect(validateFeeTable({ ...DEFAULT_FEE_TABLE, upi: { bps: -1 } })).toHaveLength(1);
  });
});

describe('availability', () => {
  const base = {
    roomTypeId: 'bed-in-6-bed-mixed-dormitory', checkIn: '2026-12-01', checkOut: '2026-12-03',
    capacity: () => 18, now: at('2026-11-19T06:00:00Z'), blockedNights: new Set<string>(),
  };
  it('subtracts confirmed bookings and live holds; the tightest night decides', () => {
    const input = {
      ...base,
      confirmed: [{ roomTypeId: base.roomTypeId, night: '2026-12-01', units: 5 }],
      holds: [
        { roomTypeId: base.roomTypeId, units: 3, nights: ['2026-12-01', '2026-12-02'], expiresAt: at('2026-11-19T06:10:00Z') },
        { roomTypeId: base.roomTypeId, units: 9, nights: ['2026-12-02'], expiresAt: at('2026-11-19T05:59:00Z') }, // expired
      ],
    };
    expect(freeUnitsPerNight(input).map((n) => n.free)).toEqual([10, 15]);
    expect(freeUnitsForStay(input)).toBe(10);
  });
  it('sells nothing on a blocked night', () => {
    expect(freeUnitsForStay({ ...base, confirmed: [], holds: [], blockedNights: new Set(['2026-12-02']) })).toBe(0);
  });
  it('never goes below zero', () => {
    expect(freeUnitsForStay({ ...base, confirmed: [{ roomTypeId: base.roomTypeId, night: '2026-12-01', units: 25 }], holds: [] })).toBe(0);
  });
});
