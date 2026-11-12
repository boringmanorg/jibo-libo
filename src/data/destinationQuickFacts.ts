/**
 * "In short" + Quick facts for the ranking destination guides (SEO brief Task 3).
 * Unknown facts stay as visible {{PLACEHOLDERS}} for the owner to fill — never guessed.
 */
import type { MeghalayaDestination } from './meghalayaDestinations';

export const DESTINATION_GUIDE_UPDATED = '2026-11-12';

type Facts = { km?: string; time?: string; entryFee?: string; timings?: string; difficulty?: string; parking?: string };

/** Only values already stated in the guide copy; everything else is a placeholder. */
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
  const km = k.km ?? '{{KM}}';
  const time = k.time ?? '{{TIME}}';
  const season = firstClause(d.bestTimeToVisit);
  const inShort = `${d.shortDescription.replace(/\s*—\s*/g, ', ').replace(/\.$/, '')}. It is ${km} from Shillong (${time}); best time: ${season}. Stay at XTSY Travellers Hostel in New Shillong Township as your base.`;
  const rows: [string, string][] = [
    ['Location', `${d.name}, ${d.region}, Meghalaya`],
    ['Distance from Shillong', `${km} (${time})`],
    ['Entry fee', `${k.entryFee ?? '{{ENTRY_FEE}}'} (checked {{FACT_CHECK_DATE}})`],
    ['Timings', k.timings ?? '{{TIMINGS}}'],
    ['Best season', season],
    ['Trek difficulty', k.difficulty ?? '{{TREK_DIFFICULTY}}'],
    ['Parking', k.parking ?? '{{PARKING}}'],
  ];
  return { inShort, rows };
}
