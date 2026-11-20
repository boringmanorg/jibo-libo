/**
 * useIntelligentSearch — instant search as the guest types.
 * Every page on the site (curated entries plus public/search-pages.json) is searched on each
 * keystroke with a small token index (src/lib/search/quickSearch.ts); results are grouped by
 * section, best section first. The index loads once, when the search opens.
 */

import { useState, useCallback, useEffect, useMemo, useDeferredValue } from 'react';
import type { SearchEntry, SearchCategory } from '@/data/searchIndex';
import { loadQuickIndex, quickSearch, type QuickIndex } from '@/lib/search/quickSearch';

// ---- Intent routing: known SEO slugs we want to surface as the top hit
const INTENT_ROUTES: Array<{ match: RegExp; entry: Omit<SearchEntry, 'id'> }> = [
  {
    match: /\b(stay|hostel|hotel|room)\b.*\bdawki\b.*\b(today|tonight|now)\b/i,
    entry: {
      title: 'Riverside camping near Dawki',
      description: 'Shnonpedeng Riverside Camping, an XTSY partner camp: ask the desk about tonight',
      category: 'stays',
      icon: '⛺',
      url: '/stays/campsite-dawki',
      price: '₹750',
      location: 'Shnonpedeng, Meghalaya',
      keywords: ['stay dawki today', 'dawki tonight', 'last minute dawki'],
    },
  },
  {
    match: /\b(camp|camping|tent)\b.*\bdawki\b|\bdawki\b.*\b(camp|camping|tent)\b/i,
    entry: {
      title: 'Shnonpedeng Riverside Camping (XTSY partner)',
      description: 'Riverside tents on the Umngot · bed space ₹750 · full tent for two ₹1,400',
      category: 'stays',
      icon: '⛺',
      url: '/stays/campsite-dawki',
      price: '₹750',
      location: 'Shnonpedeng, Meghalaya',
      keywords: ['camping in dawki', 'dawki camping', 'tent dawki'],
    },
  },
  {
    match: /\bbest\b.*\bcamping\b.*\bdawki\b/i,
    entry: {
      title: 'Riverside camping near Dawki',
      description: 'Shnonpedeng Riverside Camping, an XTSY franchise partner camp',
      category: 'stays',
      icon: '🏕️',
      url: '/stays/campsite-dawki',
      price: '₹750',
      location: 'Shnonpedeng, Meghalaya',
      keywords: ['best camping dawki'],
    },
  },
  {
    match: /\bthings to do\b.*\bdawki\b/i,
    entry: {
      title: 'Things to do in Dawki',
      description: 'Boat ride, camping, suspension bridge, India–Bangladesh viewpoint',
      category: 'locations',
      icon: '🗺️',
      url: '/guides/dawki-guide',
      location: 'Dawki, Meghalaya',
      keywords: ['things to do dawki', 'dawki itinerary'],
    },
  },
  {
    match: /\b(book|booking)\b.*\bdawki\b/i,
    entry: {
      title: 'Dawki Camping Booking',
      description: 'Book Shnonpedeng Riverside Camping (XTSY partner) with the desk',
      category: 'stays',
      icon: '⛺',
      url: '/stays/campsite-dawki',
      price: '₹750',
      location: 'Shnonpedeng, Meghalaya',
      keywords: ['dawki booking', 'dawki camping booking'],
    },
  },
];

function resolveIntent(query: string): SearchEntry[] {
  const q = query.trim();
  if (q.length < 3) return [];
  const hits: SearchEntry[] = [];
  INTENT_ROUTES.forEach((r, i) => {
    if (r.match.test(q)) {
      hits.push({ ...r.entry, id: `intent-${i}` });
    }
  });
  return hits;
}

export interface CategorizedResults {
  category: SearchCategory;
  items: SearchEntry[];
}

export function useIntelligentSearch(limit = 40) {
  const [query, setQueryState] = useState('');
  const [index, setIndex] = useState<QuickIndex | null>(null);
  useEffect(() => {
    let live = true;
    loadQuickIndex().then((i) => { if (live) setIndex(i); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // Typing stays responsive even on slow phones: React renders results at lower priority.
  const deferred = useDeferredValue(query);
  const { results, categorizedResults } = useMemo(() => {
    const q = deferred.trim();
    if (q.length < 2 || !index) return { results: [] as SearchEntry[], categorizedResults: [] as CategorizedResults[] };
    const seen = new Set<string>();
    const items: SearchEntry[] = [];
    [...resolveIntent(q), ...quickSearch(index, q, limit).map((h) => h.entry)].forEach((it) => {
      if (!seen.has(it.url)) { seen.add(it.url); items.push(it); }
    });
    // Sections appear in the order of their best match, so the top hit is always first.
    const groups = new Map<SearchCategory, SearchEntry[]>();
    items.forEach((it) => { const g = groups.get(it.category) ?? []; g.push(it); groups.set(it.category, g); });
    const categorized = [...groups].map(([category, list]) => ({ category, items: list }));
    return { results: categorized.flatMap((c) => c.items), categorizedResults: categorized };
  }, [deferred, index, limit]);

  const isEmptyQuery = query.trim().length < 2;
  const setQuery = useCallback((q: string) => setQueryState(q), []);
  const clearSearch = useCallback(() => setQueryState(''), []);

  return {
    query,
    setQuery,
    results,
    categorizedResults,
    isSearching: !isEmptyQuery && (!index || deferred !== query),
    isReady: !!index,
    totalResults: results.length,
    hasResults: results.length > 0,
    isEmptyQuery,
    clearSearch,
  };
}
