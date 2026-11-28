/**
 * Desk room allocation after self check-in. Browser-safe and pure (allocation.test.ts).
 * The guest picks a room type; the desk picks the exact beds/rooms. Each allocation holds that
 * many units of the type on every night of the stay through a console block, so /book and the
 * console count them as taken.
 */
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { unitsOnFloor } from '@/booking/pmsFeed';

export interface Allocation { id: string; roomTypeId: string; units: string[]; checkIn: string; checkOut: string }

export function floorLabels(roomTypeId: string): string[] {
  const t = BOOKING_ROOM_TYPES.find((r) => r.id === roomTypeId);
  return t ? unitsOnFloor(t).map((u) => u.label) : [];
}

/** Labels already given to other guests on overlapping nights (check-out day is free). */
export function takenLabels(others: Allocation[], roomTypeId: string, checkIn: string, checkOut: string, selfId?: string): Set<string> {
  const out = new Set<string>();
  for (const a of others) {
    if (a.id === selfId || a.roomTypeId !== roomTypeId || !a.units.length) continue;
    if (a.checkIn < checkOut && checkIn < a.checkOut) a.units.forEach((u) => out.add(u));
  }
  return out;
}

/** Throws a desk-readable message when the allocation cannot be made. */
export function validateAllocation(input: { roomTypeId: string; units: string[]; guests: number; checkIn: string; checkOut: string }, others: Allocation[], selfId?: string): void {
  const t = BOOKING_ROOM_TYPES.find((r) => r.id === input.roomTypeId);
  if (!t) throw new Error('Unknown room type.');
  if (input.checkOut <= input.checkIn) throw new Error('Check-out must be after check-in.');
  const units = [...new Set(input.units)];
  if (!units.length) throw new Error(`Pick at least one ${t.soldAs}.`);
  const valid = new Set(floorLabels(t.id));
  const bad = units.find((u) => !valid.has(u));
  if (bad) throw new Error(`${bad} is not part of ${t.name}.`);
  const needed = t.soldAs === 'bed' ? input.guests : Math.ceil(input.guests / t.maxGuestsPerUnit);
  if (units.length < needed) throw new Error(`${input.guests} guest(s) need at least ${needed} ${t.soldAs}(s) here.`);
  const taken = takenLabels(others, t.id, input.checkIn, input.checkOut, selfId);
  const clash = units.find((u) => taken.has(u));
  if (clash) throw new Error(`${clash} is already given to another guest on those nights.`);
}

/** Last night held (the console block's end date is inclusive). */
export function lastNight(checkOut: string): string {
  const d = new Date(`${checkOut}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
