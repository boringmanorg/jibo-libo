/**
 * Instant site search: a small token index over every page, searched synchronously on each
 * keystroke (a few milliseconds for ~800 pages). Matches whole words, word prefixes (so "cher"
 * finds Cherrapunji while typing), one-letter typos on longer words, and a short list of everyday
 * synonyms. No fuzzy-search library and no query expansion, which is what made the old search lag.
 */
import type { SearchCategory, SearchEntry } from '@/data/searchIndex';

/** One row of public/search-pages.json (written by scripts/generateSearchPages.ts). */
export interface SitePage { u: string; t: string; d: string; s: SearchCategory }

interface Doc {
  entry: SearchEntry;
  titleNorm: string;
  title: string[];
  body: string[];
  boost: number;
}

export interface QuickIndex { docs: Doc[] }
export interface Hit { entry: SearchEntry; score: number }

const STOP = new Set(['a', 'an', 'the', 'in', 'of', 'to', 'for', 'and', 'at', 'on', 'with', 'near', 'my', 'me', 'i', 'is', 'from', 'by', 'or', 'how', 'what']);

/** Words guests use for the same thing. Each group is matched as alternatives. */
const SYNONYMS: string[][] = [
  ['dorm', 'dormitory', 'hostel', 'bunk', 'backpacker'],
  ['camp', 'camping', 'tent', 'tents', 'campsite', 'glamping'],
  ['shnonpedeng', 'shnongpdeng', 'dawki', 'umngot'],
  ['cherrapunji', 'cherrapunjee', 'sohra'],
  ['bike', 'bikes', 'motorbike', 'scooty', 'scooter', 'enfield'],
  ['car', 'cars', 'cab', 'taxi', 'self-drive', 'drive'],
  ['rent', 'rental', 'rentals', 'hire'],
  ['women', 'female', 'ladies', 'girls'],
  ['couple', 'couples', 'romantic', 'honeymoon'],
  ['food', 'restaurant', 'bistro', 'cafe', 'menu', 'breakfast', 'dinner'],
  ['tour', 'tours', 'package', 'packages', 'trip', 'itinerary'],
  ['glass', 'glasshouse', 'stargazing'],
  ['cheap', 'budget', 'affordable', 'price', 'prices', 'rates'],
  ['trek', 'trekking', 'hike', 'hiking'],
  ['waterfall', 'waterfalls', 'falls'],
  ['northeast', 'ne', 'sisters'],
  ['abroad', 'international', 'overseas'],
];
const SYN = new Map<string, string[]>();
for (const g of SYNONYMS) for (const w of g) SYN.set(w, g.filter((x) => x !== w));

export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9₹]+/g, ' ').trim();
const words = (s: string) => normalize(s).split(' ').filter(Boolean);
const uniq = (a: string[]) => [...new Set(a)];

const ICONS: Record<SearchCategory, string> = { stays: '🛏️', experiences: '✨', locations: '📍', tours: '🧭', pages: '📄' };

export function pageToEntry(p: SitePage): SearchEntry {
  return { id: `page:${p.u}`, title: p.t, description: p.d, category: p.s, icon: ICONS[p.s] ?? '📄', url: p.u, keywords: [] };
}

/** Curated entries (with prices and keywords) come first and win over the plain page list for the same address. */
export function buildIndex(curated: SearchEntry[], pages: SitePage[]): QuickIndex {
  const seen = new Set<string>();
  const docs: Doc[] = [];
  const add = (entry: SearchEntry, boost: number) => {
    if (seen.has(entry.url)) return;
    seen.add(entry.url);
    const path = entry.url.split(/[?#]/)[0].replace(/[-/]/g, ' ');
    docs.push({
      entry,
      boost,
      titleNorm: normalize(entry.title),
      title: uniq(words(entry.title)),
      body: uniq(words([entry.description, entry.location ?? '', path, ...(entry.keywords ?? []), ...(entry.synonyms ?? [])].join(' '))),
    });
  };
  curated.forEach((e) => add(e, 1.25));
  pages.forEach((p) => add(pageToEntry(p), 1));
  return { docs };
}

/** True when a and b differ by at most one edit (insert, delete or substitute). */
function oneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function scoreToken(q: string, d: Doc, prefixOk: boolean): number {
  let best = 0;
  for (const w of d.title) {
    if (w === q) return 10;
    if (prefixOk && w.startsWith(q)) best = Math.max(best, 7);
  }
  for (const w of d.body) {
    if (w === q) best = Math.max(best, 5);
    else if (prefixOk && best < 3.5 && w.startsWith(q)) best = 3.5;
  }
  if (best > 0) return best;
  const alts = SYN.get(q);
  if (alts) {
    for (const a of alts) {
      if (d.title.includes(a)) return 6;
      if (d.body.includes(a)) best = 3;
    }
    if (best > 0) return best;
  }
  if (q.length >= 4) {
    for (const w of d.title) if (oneEdit(q, w)) return 4;
    for (const w of d.body) if (oneEdit(q, w)) return 2;
  }
  return 0;
}

export function quickSearch(index: QuickIndex, query: string, limit = 40): Hit[] {
  const all = words(query);
  if (all.join('').length < 2) return [];
  const terms = all.length > 1 ? all.filter((w) => !STOP.has(w)) : all;
  if (terms.length === 0) return [];
  const qNorm = normalize(query);
  const needed = terms.length <= 2 ? terms.length : terms.length - 1;
  const hits: Hit[] = [];
  for (const d of index.docs) {
    let score = 0, matched = 0;
    terms.forEach((t, i) => {
      // Prefixes count for every word of 2+ letters, and always for the word being typed.
      const s = scoreToken(t, d, t.length >= 2 || i === terms.length - 1);
      if (s > 0) { matched++; score += s; }
    });
    if (matched < needed) continue;
    if (d.titleNorm.startsWith(qNorm)) score += 12;
    else if (d.titleNorm.includes(qNorm)) score += 8;
    hits.push({ entry: d.entry, score: score * d.boost });
  }
  hits.sort((a, b) => b.score - a.score || a.entry.title.length - b.entry.title.length);
  return hits.slice(0, limit);
}

let loading: Promise<QuickIndex> | null = null;
/** Loads the curated index and the full page list once per visit (the page list is a static file). */
export function loadQuickIndex(): Promise<QuickIndex> {
  if (!loading) {
    loading = Promise.all([
      import('@/data/searchIndex').then((m) => m.getSearchIndex()),
      fetch('/search-pages.json').then((r) => (r.ok ? r.json() : [])).catch(() => []) as Promise<SitePage[]>,
    ]).then(([curated, pages]) => {
      if (!Array.isArray(pages) || pages.length === 0) loading = null; // try the page list again next time
      return buildIndex(curated, Array.isArray(pages) ? pages : []);
    });
    loading.catch(() => { loading = null; });
  }
  return loading;
}
