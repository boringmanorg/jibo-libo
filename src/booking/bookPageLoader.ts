/**
 * Loader for /book and /book/campsite: online-booking switch, console photos, console blocks and
 * the Google Sheet's date-wise availability.
 * A paused Cloud database must not hold the page: after 4.5 s guests get the last good data (or the
 * built-in photos and no blocks); a slow or failed refresh never wipes the sheet's numbers.
 */
import { getBookPageDataFn } from './publicEngine.functions';
import type { ClosureRow } from './consoleClosures';
import type { SheetAvailability } from './sheetAvailability';
import type { SmartRule } from './smartPricing';

export type BookPageData = { live: boolean; photos: Record<string, { src: string; alt: string }[]>; closures: ClosureRow[]; sheet: SheetAvailability; pricing?: SmartRule[]; refreshAt?: number; pending?: boolean };

/**
 * What the server sends with the /book HTML: nothing live yet. The page (header, hostel photos,
 * dates) goes out at once instead of waiting on the database; the browser fetches the live counts
 * straight after it starts, and the room list shows placeholders until they arrive. No room is ever
 * offered from a count that was not read live.
 */
export const BOOK_PAGE_PENDING: BookPageData = { live: false, photos: {}, closures: [], sheet: {}, pending: true };

/** Last data that arrived in time: a slow refresh keeps showing it instead of dropping the sheet's numbers. */
let lastGood: BookPageData | null = null;

/** Seed with data the page already shows (e.g. server-rendered), so a later slow refresh keeps it. */
export function rememberBookPageData(data: BookPageData) {
  if (data.pending) return;
  if (!lastGood || Object.keys(data.sheet).length > 0) lastGood = data;
}

export async function loadBookPageData(): Promise<BookPageData> {
  const fallback: BookPageData = lastGood ?? { live: false, photos: {}, closures: [], sheet: {} };
  try {
    const fresh = await Promise.race([
      getBookPageDataFn() as Promise<BookPageData>,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500)),
    ]);
    if (!fresh) return fallback;
    // An empty sheet on refresh means the read failed: keep the numbers we already had.
    if (Object.keys(fresh.sheet).length === 0 && lastGood && Object.keys(lastGood.sheet).length > 0) {
      return { ...fresh, sheet: lastGood.sheet };
    }
    lastGood = fresh;
    return fresh;
  } catch {
    return fallback;
  }
}
