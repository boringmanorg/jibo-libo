/**
 * Loader for /book and /book/campsite: online-booking switch, console photos, console blocks and
 * the Google Sheet's date-wise availability.
 * A paused Cloud database must not hold the page: after 1.5 s guests get the page with the
 * built-in photos and no blocks (the desk still confirms every enquiry).
 */
import { getBookPageDataFn } from './publicEngine.functions';
import type { ClosureRow } from './consoleClosures';
import type { SheetAvailability } from './sheetAvailability';

export type BookPageData = { live: boolean; photos: Record<string, { src: string; alt: string }[]>; closures: ClosureRow[]; sheet: SheetAvailability };

export async function loadBookPageData(): Promise<BookPageData> {
  const fallback: BookPageData = { live: false, photos: {}, closures: [], sheet: {} };
  try {
    return await Promise.race([
      getBookPageDataFn() as Promise<BookPageData>,
      new Promise<BookPageData>((resolve) => setTimeout(() => resolve(fallback), 1500)),
    ]);
  } catch {
    return fallback;
  }
}
