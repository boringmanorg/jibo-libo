/**
 * "In short" + Quick facts for the ranking destination guides (SEO brief Task 3).
 *
 * Unknown facts are OMITTED, never guessed and never rendered as a raw
 * template token. The earlier version substituted placeholder codes so the owner
 * could find and fill them, but those codes shipped to production and showed
 * on ~19 public destination pages (entry fees, timings, parking, trek
 * difficulty and distances all rendered as their raw template codes).
 *
 * Omitting is deliberate over printing "Not confirmed" on every row: the same
 * filler repeated down six rows across nineteen pages is duplicate thin
 * content, and it tells a reader nothing a missing row doesn't. A short table
 * of facts we can actually stand behind is worth more than a long table of
 * admissions.
 *
 * To publish a fact, add it to KNOWN below. Entry fees and timings change
 * seasonally and are set by local bodies, so only add a value that has been
 * checked against the site itself.
 */
import type { MeghalayaDestination } from './meghalayaDestinations';

export const DESTINATION_GUIDE_UPDATED = '2026-11-12';

type Facts = { km?: string; time?: string; entryFee?: string; timings?: string; difficulty?: string; parking?: string };

/** Only values already stated in the guide copy. Anything absent is left out of the table. */
const KNOWN: Record<string, Facts> = {
  'elephant-falls': { km: '12 km', time: 'about 30 minutes by road' },
};

export const QUICK_FACT_SLUGS = new Set([
  'elephant-falls', 'mawsmai-cave', 'double-decker-living-root-bridge', 'krang-suri-falls', 'phe-phe-falls',
  'kynrem-falls', 'shnongpdeng', 'umiam-lake', 'dawki-umngot-river', 'nohkalikai-falls', 'spread-eagle-falls',
  'bishop-falls', 'balpakram-national-park', 'nongkhnum-island', 'wah-rilang-viewpoint', 'sweet-falls',
  'laitlum-canyons', 'nongjrong-sunrise-viewpoint', 'seven-sisters-falls', 'nartiang-monoliths',
]);

const firstClause = (s: string) => s.split(/(?<=[.;])\s/)[0].replace(/[.;]$/, '');

export function quickFactsFor(d: MeghalayaDestination) {
  if (!QUICK_FACT_SLUGS.has(d.slug)) return null;
  const k = KNOWN[d.slug] ?? {};
  const season = firstClause(d.bestTimeToVisit);
  const base = d.shortDescription.replace(/\s*—\s*/g, ', ').replace(/\.$/, '');

  // The distance clause only appears when both halves are known, so the
  // sentence never reads "It is from Shillong ()".
  const hasDistance = Boolean(k.km && k.time);
  const inShort = hasDistance
    ? `${base}. It is ${k.km} from Shillong (${k.time}); best time: ${season}. Stay at XTSY Travellers Hostel in New Shillong Township as your base.`
    : `${base}. Best time to visit: ${season}. Stay at XTSY Travellers Hostel in New Shillong Township as your base.`;

  const rows: [string, string][] = [['Location', `${d.name}, ${d.region}, Meghalaya`]];
  if (hasDistance) rows.push(['Distance from Shillong', `${k.km} (${k.time})`]);
  // "checked <date>" is only meaningful next to a fee we actually have.
  if (k.entryFee) rows.push(['Entry fee', `${k.entryFee} (checked ${DESTINATION_GUIDE_UPDATED})`]);
  if (k.timings) rows.push(['Timings', k.timings]);
  rows.push(['Best season', season]);
  if (k.difficulty) rows.push(['Trek difficulty', k.difficulty]);
  if (k.parking) rows.push(['Parking', k.parking]);

  return { inShort, rows };
}
