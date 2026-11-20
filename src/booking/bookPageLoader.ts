/**
 * Loader for /book and /book/campsite: online-booking switch, console photos and console blocks.
 * A paused Cloud database must not hold the page: after 1.5 s guests get the page with the
 * built-in photos and no blocks (the desk still confirms every enquiry).
 */
import { getBookPageDataFn } from './publicEngine.functions';
import type { ClosureRow } from './consoleClosures';

export type BookPageData = { live: boolean; photos: Record<string, { src: string; alt: string }[]>; closures: ClosureRow[] };

export async function loadBookPageData(): Promise<BookPageData> {
  const fallback: BookPageData = { live: false, photos: {}, closures: [] };
  try {
    return await Promise.race([
      getBookPageDataFn() as Promise<BookPageData>,
      new Promise<BookPageData>((resolve) => setTimeout(() => resolve(fallback), 1500)),
    ]);
  } catch {
    return fallback;
  }
}
