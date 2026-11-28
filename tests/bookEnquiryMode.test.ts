import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { staticDateProblem, staticQuote, staticSearch } from '../src/booking/staticSearch';
import { BOOKING_ROOM_TYPES } from '../src/booking/catalogue';

const NOW = new Date('2026-11-20T06:00:00Z');

describe('/book before online booking is live', () => {
  it('lists every room from the catalogue with its rate and a 7-night price strip', () => {
    const r = staticSearch('2026-12-01', '2026-12-03');
    expect(r.live).toBe(false);
    expect(r.nights).toBe(2);
    expect(r.rooms.map((x) => x.id)).toEqual(BOOKING_ROOM_TYPES.map((x) => x.id));
    expect(r.rooms.every((x) => x.strip.length === 7)).toBe(true);
    expect(r.fromRate).toBe(40000);
  });

  it('uses console-uploaded photos when the page has them', () => {
    const r = staticSearch('2026-12-01', '2026-12-02', { 'triple-room-with-mountain-view': [{ src: 'https://x/a.jpg', alt: 'Triple' }] });
    expect(r.rooms.find((x) => x.id === 'triple-room-with-mountain-view')!.photos).toEqual([{ src: 'https://x/a.jpg', alt: 'Triple' }]);
    expect(r.rooms.find((x) => x.id === 'king-room-with-mountain-view')!.photos).toEqual([]);
  });

  it('quotes with GST and the 25% advance, same as the live engine', () => {
    const q = staticQuote({ checkIn: '2026-12-01', checkOut: '2026-12-02', rooms: [{ roomTypeId: 'king-room-with-mountain-view', units: 1, guests: 2 }], breakfast: [], method: 'upi' });
    expect(q.quote.total).toBe(252000);
    expect(q.quote.advance).toBe(63000);
  });

  it('checks dates in the browser', () => {
    expect(staticDateProblem('2026-11-19', '2026-11-20', NOW)).toMatch(/past/);
    expect(staticDateProblem('2026-11-21', '2026-11-21', NOW)).toMatch(/after check-in/);
    expect(staticDateProblem('2026-11-21', '2026-11-22', NOW)).toBeNull();
  });

  it('/book always renders the new page: payment when live, WhatsApp enquiry otherwise', () => {
    const route = readFileSync('src/routes/(stays)/book/index.tsx', 'utf8');
    expect(route).toMatch(/<StayEngine [^>]*mode=\{live \? "live" : "enquiry"\}/);
    expect(route).not.toMatch(/SimplifiedBookingFlow/);
    // The server sends the page at once (no database wait); the browser fetches the live counts.
    expect(route).toMatch(/loader: \(\) => \(import\.meta\.env\.SSR \? BOOK_PAGE_PENDING : loadBookPageData\(\)\)/);
    expect(route).toMatch(/if \(!routeData\.pending\) return;[\s\S]*loadBookPageData\(\)/);
    expect(readFileSync('src/components/booking/engine/StayEngine.tsx', 'utf8')).toMatch(/if \(pending\) \{ setResult\(null\); return; \}/);
    // A paused database must not hold the page.
    expect(readFileSync('src/booking/bookPageLoader.ts', 'utf8')).toMatch(/setTimeout\(\(\) => resolve\(null\), 4500\)/);
  });
});
