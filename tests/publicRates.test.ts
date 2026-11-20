import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_ROOM_ID, publicRate } from '../src/data/publicRates';
import { BOOKING_ROOM_TYPES } from '../src/booking/catalogue';
import { ROOM_INVENTORY } from '../src/data/roomInventory';
import { ROOM_TYPES } from '../src/config/roomTypes';
import { quoteStay } from '../src/data/panoramaPricing';
import { resolveBookingQuote } from '../src/utils/bookingCatalogue';
import { staticRoomCatalogue } from '../src/lib/localEnquiry';

describe('one source for public room rates', () => {
  it('every public room maps to a booking-engine room and its rate', () => {
    for (const [siteId, engineId] of Object.entries(ENGINE_ROOM_ID)) {
      const engine = BOOKING_ROOM_TYPES.find((r) => r.id === engineId)!;
      expect(engine, engineId).toBeTruthy();
      expect(publicRate(siteId)).toBe(engine.rate / 100);
      expect(ROOM_INVENTORY[siteId].discountedPrice).toBe(engine.rate / 100);
      expect(ROOM_TYPES[siteId].basePrice).toBe(engine.rate / 100);
      expect(ROOM_INVENTORY[siteId].totalUnits).toBe(engine.units);
    }
  });

  it('the triple room uses the King room photos until its own are uploaded', () => {
    expect(ROOM_INVENTORY['triple-room'].images).toEqual(ROOM_INVENTORY['king-double-room'].images);
  });

  it('the WhatsApp enquiry flow quotes the new triple room and standard dorm', () => {
    const cat = staticRoomCatalogue();
    expect(resolveBookingQuote(cat, [{ name: 'Triple Room with Mountain View', quantity: 1, kind: 'private', capacity: 3 }], 1).total).toBe(3150);
    expect(resolveBookingQuote(cat, [{ name: 'Bed in 6-Bed Standard Dormitory', quantity: 2, kind: 'dorm', capacity: 6 }], 1).total).toBe(945);
  });

  it('enquiry quotes add GST on top of the rate', () => {
    const q = quoteStay([{ nightlyRate: 400, quantity: 2 }], 2);
    expect(q.subtotal).toBe(1600);
    expect(q.taxes).toBe(80);
    expect(q.total).toBe(1680);
  });
});

describe('no retired prices or all-inclusive room wording', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(n)) files.push(p);
    }
  };
  walk('src');
  files.push('public/llms.txt', 'public/llms-full.txt');

  it('old room prices ₹399 / ₹499 / ₹599 / ₹2,399 are gone', () => {
    const hits = files.flatMap((f) => (readFileSync(f, 'utf8').match(/(₹|\\u20b9)(399|499|599|2,?399)\b/g) ?? []).map((m) => `${f}: ${m}`));
    expect(hits).toEqual([]);
  });

  it('room prices are not described as all inclusive or GST included', () => {
    const rx = /(all[- ]inclusive|gst[- ]included|gst[- ]inclusive|taxes included|taxes incl\.|incl\.? taxes|including taxes)/i;
    const hits = files.flatMap((f) =>
      readFileSync(f, 'utf8').split('\n').filter((l) => rx.test(l) && /(dorm|room|suite|night|bed|Experience by XTSY)/i.test(l) && !/(tour|package|per ?person|meals|transport|menu prices|passes|tickets)/i.test(l)).map((l) => `${f}: ${l.trim().slice(0, 120)}`),
    );
    expect(hits).toEqual([]);
  });
});
