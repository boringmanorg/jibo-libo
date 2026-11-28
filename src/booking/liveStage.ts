/**
 * Anonymous booking-page step log for the console's Live insights.
 * One random code per page visit, kept in memory only (no cookie, no storage, no personal data);
 * each step is sent once, on the guest's own action, never on a timer.
 */
import { useEffect, useRef } from 'react';
import { trackLiveStageFn } from './publicEngine.functions';

export type LiveStage = 'view' | 'rooms' | 'details' | 'contacted';
export const LIVE_PROPERTY = { hostel: 'XTSY-SHL-HOSTEL', camp: 'XTSY-SHN-CAMP' } as const;

const visit = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null;
const sent = new Set<string>();

export function sendLiveStage(propertyId: string, stage: LiveStage, reference?: string) {
  if (!visit || typeof window === 'undefined') return;
  const key = `${propertyId}:${stage}`;
  if (sent.has(key)) return;
  sent.add(key);
  void trackLiveStageFn({ data: { session: visit, propertyId, stage, reference } }).catch(() => undefined);
}

/** Sends `stage` once when `when` first becomes true. */
export function useLiveStage(propertyId: string, stage: LiveStage, when = true) {
  const done = useRef(false);
  useEffect(() => {
    if (when && !done.current) { done.current = true; sendLiveStage(propertyId, stage); }
  }, [propertyId, stage, when]);
}
