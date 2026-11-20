/**
 * Blocks and openings the owner sets in the console (Stays → Block or open dates), applied to the
 * guest booking page. Browser-safe: the server sends the rows, and the page works out what is free.
 *
 * Rules:
 * - A blocked row closes every bed or room of that type on each night from start to end
 *   (end inclusive), or only `units` of them when a number is set.
 * - An open row made after a block cancels that block on the nights they share.
 * - Several partial blocks on the same night add up.
 */
import { ENGINE_ROOM_ID } from '@/data/publicRates';
import type { IsoDate } from './dates';

export interface ClosureRow {
  /** Console room id (e.g. "8-bed-mixed-dorm") or booking-engine id. */
  unit: string;
  start: IsoDate;
  /** Inclusive: the last night closed. */
  end: IsoDate;
  state: 'blocked' | 'open';
  /** How many beds or rooms to close; null closes them all. */
  units: number | null;
  /** When the row was made (ISO), so a later opening wins over an earlier block. */
  at: string;
}

const engineId = (unit: string) => ENGINE_ROOM_ID[unit] ?? unit;
const covers = (r: ClosureRow, night: IsoDate) => r.start <= night && night <= r.end;

/** Beds or rooms closed by the console for this room type on this night (Infinity = all). */
export function closedUnits(rows: ClosureRow[], roomTypeId: string, night: IsoDate): number {
  const id = engineId(roomTypeId);
  const mine = rows.filter((r) => engineId(r.unit) === id && covers(r, night));
  const opens = mine.filter((r) => r.state === 'open');
  let closed = 0;
  for (const b of mine) {
    if (b.state !== 'blocked') continue;
    if (opens.some((o) => o.at > b.at)) continue;
    closed += b.units ?? Infinity;
  }
  return closed;
}

/** Free beds or rooms after console closures, never below zero. */
export const freeAfterClosures = (rows: ClosureRow[], roomTypeId: string, night: IsoDate, capacity: number) =>
  Math.max(0, capacity - closedUnits(rows, roomTypeId, night));

/** Database row → ClosureRow. Tolerates a database without the `units` column yet. */
export function closureFromRow(row: Record<string, unknown>): ClosureRow | null {
  const state = row.state === 'blocked' || row.state === 'open' ? row.state : null;
  const start = typeof row.start_date === 'string' ? row.start_date.slice(0, 10) : null;
  const end = typeof row.end_date === 'string' ? row.end_date.slice(0, 10) : null;
  if (!state || !start || !end || typeof row.unit_type_id !== 'string') return null;
  const units = typeof row.units === 'number' && row.units > 0 ? row.units : null;
  return { unit: row.unit_type_id, start, end, state, units, at: String(row.created_at ?? '') };
}
