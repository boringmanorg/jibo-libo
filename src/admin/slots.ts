import { BISTRO_SLOT_RANGES } from '@/data/tabBistroHours';

/** Table slots every 15 minutes inside the shared Bistro service ranges. */
export function staticTableSlots(step = 15): string[] {
  const out: string[] = [];
  for (const r of BISTRO_SLOT_RANGES) {
    for (let m = r.from; m <= r.to; m += step) {
      out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
  }
  return out;
}

/** True when [aStart,aEnd) nights overlap a blocked inclusive date range. */
export function rangeHitsBlock(checkIn: string, checkOut: string, start: string, end: string): boolean {
  return checkIn <= end && checkOut > start;
}
