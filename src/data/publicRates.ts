/**
 * Public room rates for marketing and enquiry pages, read from the booking engine's catalogue
 * (src/booking/catalogue.ts, owner-confirmed 19 Nov 2026) so every page shows the same price.
 * Rates are per night, per bed or room, and EXCLUDE GST, breakfast and payment gateway charges.
 */
import { findRoomType } from '@/booking/catalogue';

/** Site room ids (older pages and the enquiry flow) → booking-engine room type ids. */
export const ENGINE_ROOM_ID: Record<string, string> = {
  'xtsy-270': 'experience-by-xtsy',
  'king-double-room': 'king-room-with-mountain-view',
  'triple-room': 'triple-room-with-mountain-view',
  '4-bed-female-only-dorm': 'bed-in-4-bed-female-deluxe-dormitory',
  '6-bed-mixed-dorm': 'bed-in-6-bed-mixed-dormitory',
  '6-bed-standard-dorm': 'bed-in-6-bed-standard-dormitory',
  '8-bed-mixed-dorm': 'bed-in-8-bed-mixed-dormitory',
};

/** Nightly rate in whole rupees, before GST. */
export function publicRate(siteRoomId: string): number {
  const room = findRoomType(ENGINE_ROOM_ID[siteRoomId] ?? siteRoomId);
  if (!room) throw new Error(`No booking-engine rate for room ${siteRoomId}`);
  return room.rate / 100;
}

/** Units sold per night (beds for dorms, rooms otherwise). */
export function publicUnits(siteRoomId: string): number {
  return findRoomType(ENGINE_ROOM_ID[siteRoomId] ?? siteRoomId)?.units ?? 0;
}

/** One phrase for how rates are quoted, wherever a price appears. */
export const RATE_BASIS = 'plus GST';
export const RATE_BASIS_LONG = 'Rates exclude GST, breakfast and payment gateway charges.';
