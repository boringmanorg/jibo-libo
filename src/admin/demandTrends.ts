import { classifyQuery, type DemandPropertyId, type QueryRow } from '@/booking/demandIntent';

export interface DailyDemand { date: string; impressions: number; clicks: number }
export interface SearchQuery { query: string; impressions: number; clicks: number }

/** A complete, comparable 35-day series, including zero-appearance days. */
export function dailyDemand(rows: QueryRow[], propertyId: DemandPropertyId, windowEnd: string): DailyDemand[] {
  const end = Date.parse(`${windowEnd}T00:00:00Z`);
  const days = Array.from({ length: 35 }, (_, i) => ({ date: new Date(end - (34 - i) * 86_400_000).toISOString().slice(0, 10), impressions: 0, clicks: 0 }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const row of rows) {
    if (classifyQuery(row.query) !== propertyId) continue;
    const day = byDate.get(row.date);
    if (day) { day.impressions += row.impressions; day.clicks += row.clicks; }
  }
  return days;
}

/** Older snapshots stored just queries; do not manufacture a historical chart for them. */
export function decodeDemandDetails(value: unknown): { queries: SearchQuery[]; daily: DailyDemand[] } {
  const query = (v: unknown): v is SearchQuery => !!v && typeof v === 'object' && 'query' in v && typeof v.query === 'string' && 'impressions' in v && typeof v.impressions === 'number' && 'clicks' in v && typeof v.clicks === 'number';
  if (Array.isArray(value)) return { queries: value.filter(query), daily: [] };
  if (!value || typeof value !== 'object') return { queries: [], daily: [] };
  const queries = 'queries' in value && Array.isArray(value.queries) ? value.queries.filter(query) : [];
  const daily = 'daily' in value && Array.isArray(value.daily) ? value.daily.filter((v): v is DailyDemand => !!v && typeof v === 'object' && 'date' in v && typeof v.date === 'string' && 'impressions' in v && typeof v.impressions === 'number' && 'clicks' in v && typeof v.clicks === 'number') : [];
  return { queries, daily };
}