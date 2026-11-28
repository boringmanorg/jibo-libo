/**
 * Search-intent demand for smart pricing. Browser-safe and pure (tests/demandIntent.test.ts).
 *
 * Reads Google search appearances (impressions, clicks not required) and sorts each search into
 * the property it is really about:
 *   - Shillong / New Shillong stay searches → XTSY Travellers Hostel
 *   - Dawki / Shnongpdeng / Umngot river searches → Shnonpedeng Riverside Camping by XTSY
 *   - everything else (Phe Phe falls, Jowai, Sohra, other states …) → ignored, never moves a price
 * Demand = last 7 days of appearances against the weekly average of the 28 days before.
 * Too few appearances = neutral, so small numbers never move a price.
 */
export type DemandPropertyId = 'XTSY-SHL-HOSTEL' | 'XTSY-SHN-CAMP';
export type Cluster = DemandPropertyId | 'ignore';

/** Places that are NOT about our stays even when they mention Meghalaya. Checked first. */
const IGNORE = ['phe phe', 'jowai', 'krang suri', 'krangsuri', 'nartiang', 'jaintia', 'sohra', 'cherrapunji', 'cherrapunjee', 'mawsynram', 'nongriat', 'living root', 'double decker', 'mizoram', 'tripura', 'assam', 'guwahati', 'kaziranga', 'tawang', 'arunachal', 'nagaland', 'manipur', 'sikkim', 'mawphanlur', 'garo', 'tura', 'nongkhnum'];
const CAMP = ['dawki', 'shnongpdeng', 'shnonpedeng', 'shnongpedeng', 'umngot', 'mawlynnong', 'riverside camp', 'river camp', 'camping meghalaya', 'meghalaya camping', 'camping in meghalaya', 'clear river', 'clearest river', 'tamabil'];
const HOSTEL = ['xtsy', 'xsty', 'new shillong', 'shillong', 'laitumkhrah', 'police bazar', 'policebazar', 'mawdiangdiang', 'umiam', 'barapani', 'laitlum', 'elephant falls', 'ward lake', 'upper shillong', 'mawlai', 'nongthymmai'];

export function classifyQuery(query: string): Cluster {
  const q = ` ${query.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const has = (list: string[]) => list.some((w) => q.includes(` ${w} `) || q.includes(` ${w}s `));
  if (has(IGNORE)) return 'ignore';
  if (has(CAMP)) return 'XTSY-SHN-CAMP';
  if (has(HOSTEL)) return 'XTSY-SHL-HOSTEL';
  return 'ignore';
}

export interface QueryRow { query: string; date: string; impressions: number; clicks: number }
export interface DemandReading {
  propertyId: DemandPropertyId;
  recentImpressions: number;   // last 7 days
  baselineWeekly: number;      // weekly average of the 28 days before
  ratio: number;               // recent / baseline (1 = normal)
  multiplier: number;          // price factor from demand alone
  topQueries: { query: string; impressions: number; clicks: number }[];
}

/** Minimum appearances in the last 7 days before demand may move a price. */
export const MIN_RECENT = 40;

export function demandMultiplier(ratio: number, recent: number): number {
  if (recent < MIN_RECENT || !Number.isFinite(ratio)) return 1;
  if (ratio >= 1.5) return 1.1;
  if (ratio >= 1.2) return 1.05;
  if (ratio <= 0.6) return 0.95;
  return 1;
}

/** `windowEnd` = last day with data (inclusive). Rows outside the 35-day window are ignored. */
export function readDemand(rows: QueryRow[], windowEnd: string): DemandReading[] {
  const end = Date.parse(`${windowEnd}T00:00:00Z`);
  const day = 86_400_000;
  const out: DemandReading[] = [];
  for (const propertyId of ['XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP'] as const) {
    let recent = 0, base = 0;
    const tops = new Map<string, { impressions: number; clicks: number }>();
    for (const r of rows) {
      if (classifyQuery(r.query) !== propertyId) continue;
      const age = Math.round((end - Date.parse(`${r.date}T00:00:00Z`)) / day);
      if (age < 0 || age >= 35) continue;
      if (age < 7) {
        recent += r.impressions;
        const t = tops.get(r.query) ?? { impressions: 0, clicks: 0 };
        t.impressions += r.impressions; t.clicks += r.clicks; tops.set(r.query, t);
      } else base += r.impressions;
    }
    const baselineWeekly = base / 4;
    const ratio = baselineWeekly > 0 ? recent / baselineWeekly : recent > 0 ? 2 : 1;
    out.push({
      propertyId, recentImpressions: recent, baselineWeekly: Math.round(baselineWeekly), ratio: Math.round(ratio * 100) / 100,
      multiplier: demandMultiplier(ratio, recent),
      topQueries: [...tops.entries()].sort((a, b) => b[1].impressions - a[1].impressions).slice(0, 8).map(([query, v]) => ({ query, ...v })),
    });
  }
  return out;
}
