/** Live insights: turns booking-page step rows into per-property funnel numbers. Pure (tests/liveInsights.test.ts). */
export type Stage = 'view' | 'rooms' | 'details' | 'contacted';
export interface LiveRow { session: string; propertyId: string; stage: Stage; at: string; reference: string | null }
export const ACTIVE_MINUTES = 15;
export const DROP_MINUTES = 30;
const ORDER: Stage[] = ['view', 'rooms', 'details', 'contacted'];

export interface PropertyFunnel {
  propertyId: string;
  now: { viewing: number; rooms: number; details: number };
  period: { visits: number; rooms: number; details: number; contacted: number; dropped: number };
  contactedRefs: string[];
}

/** Each visit counts once at its furthest step. "Now" = last step within ACTIVE_MINUTES and not contacted;
 * dropped = reached rooms or details, never contacted, quiet for DROP_MINUTES. */
export function summarizeLive(rows: LiveRow[], nowMs: number, properties: string[]): PropertyFunnel[] {
  const visits = new Map<string, { propertyId: string; best: number; last: number; ref: string | null }>();
  for (const r of rows) {
    const k = `${r.propertyId}|${r.session}`;
    const v = visits.get(k) ?? { propertyId: r.propertyId, best: -1, last: 0, ref: null };
    v.best = Math.max(v.best, ORDER.indexOf(r.stage));
    v.last = Math.max(v.last, Date.parse(r.at));
    if (r.reference) v.ref = r.reference;
    visits.set(k, v);
  }
  const ids = [...new Set([...properties, ...[...visits.values()].map((v) => v.propertyId)])];
  return ids.map((propertyId) => {
    const f: PropertyFunnel = { propertyId, now: { viewing: 0, rooms: 0, details: 0 }, period: { visits: 0, rooms: 0, details: 0, contacted: 0, dropped: 0 }, contactedRefs: [] };
    for (const v of visits.values()) {
      if (v.propertyId !== propertyId) continue;
      const quiet = (nowMs - v.last) / 60_000;
      f.period.visits++;
      if (v.best >= 1) f.period.rooms++;
      if (v.best >= 2) f.period.details++;
      if (v.best === 3) { f.period.contacted++; if (v.ref) f.contactedRefs.push(v.ref); continue; }
      if (quiet <= ACTIVE_MINUTES) {
        if (v.best === 2) f.now.details++; else if (v.best === 1) f.now.rooms++; else f.now.viewing++;
      } else if (v.best >= 1 && quiet >= DROP_MINUTES) f.period.dropped++;
    }
    return f;
  });
}
