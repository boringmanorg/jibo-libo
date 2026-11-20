/**
 * Loader for /book and /book/campsite: online-booking switch, console photos, console blocks and
 * the Google Sheet's date-wise availability.
 * A paused Cloud database must not hold the page: after 1.5 s guests get the page with the
 * built-in photos and no blocks (the desk still confirms every enquiry).
 */
import { getBookPageDataFn } from './publicEngine.functions';
import type { ClosureRow } from './consoleClosures';
import type { SheetAvailability } from './sheetAvailability';

export type BookPageData = { live: boolean; photos: Record<string, { src: string; alt: string }[]>; closures: ClosureRow[]; sheet: SheetAvailability; refreshAt?: number };

/** Last data that arrived in time: a slow refresh keeps showing it instead of dropping the sheet's numbers. */
let lastGood: BookPageData | null = null;

export async function loadBookPageData(): Promise<BookPageData> {
  const fallback: BookPageData = lastGood ?? { live: false, photos: {}, closures: [], sheet: {} };
  try {
    const fresh = await Promise.race([
      getBookPageDataFn() as Promise<BookPageData>,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (!fresh) return fallback;
    lastGood = fresh;
    return fresh;
  } catch {
    return fallback;
  }
}
