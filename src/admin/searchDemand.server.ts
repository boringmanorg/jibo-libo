/**
 * Google search appearances for xtsy.one (Search Console, through the connector gateway).
 * Called only when the super admin presses "Refresh search demand" — never on a timer.
 */
import type { QueryRow } from '@/booking/demandIntent';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_search_console';

function headers() {
  const lovable = process.env['LOVABLE_API_KEY'];
  const conn = process.env['GOOGLE_SEARCH_CONSOLE_API_KEY'];
  if (!lovable || !conn) throw new Error('Google Search Console is not connected to this project.');
  return { Authorization: `Bearer ${lovable}`, 'X-Connection-Api-Key': conn, 'Content-Type': 'application/json' };
}

/** The verified Search Console property covering xtsy.one, re-listed on every refresh. */
async function resolveSite(): Promise<string> {
  const res = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: headers() });
  if (!res.ok) throw new Error(`Search Console could not list properties [${res.status}]: ${(await res.text()).slice(0, 200)}`);
  const { siteEntry = [] } = (await res.json()) as { siteEntry?: { siteUrl: string; permissionLevel?: string }[] };
  const matches = siteEntry.filter((e) => e.permissionLevel !== 'siteUnverifiedUser' && (e.siteUrl === 'sc-domain:xtsy.one' || /^https?:\/\/(www\.)?xtsy\.one\/$/.test(e.siteUrl)));
  if (matches.length === 0) throw new Error('No verified Search Console property covers xtsy.one.');
  if (matches.length > 1) throw new Error(`More than one Search Console property covers xtsy.one (${matches.map((m) => m.siteUrl).join(', ')}). Tell the builder which one to use.`);
  return matches[0]!.siteUrl;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Daily query rows for the 35 days ending 3 days ago (Search Console data lags 2–3 days). */
export async function fetchSearchRows(now: Date): Promise<{ rows: QueryRow[]; windowEnd: string }> {
  const site = await resolveSite();
  const end = new Date(now.getTime() - 3 * 86_400_000);
  const start = new Date(end.getTime() - 34 * 86_400_000);
  const rows: QueryRow[] = [];
  for (let startRow = 0; startRow < 50_000; startRow += 25_000) {
    const res = await fetch(`${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ startDate: iso(start), endDate: iso(end), dimensions: ['query', 'date'], rowLimit: 25_000, startRow }),
    });
    if (res.status === 403) throw new Error('The connected Google account cannot read Search Console for xtsy.one.');
    if (!res.ok) throw new Error(`Search Console query failed [${res.status}]: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { rows?: { keys: [string, string]; impressions: number; clicks: number }[] };
    const page = body.rows ?? [];
    for (const r of page) rows.push({ query: r.keys[0], date: r.keys[1], impressions: r.impressions, clicks: r.clicks });
    if (page.length < 25_000) break;
  }
  return { rows, windowEnd: iso(end) };
}
