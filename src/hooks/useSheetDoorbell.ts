import { useEffect, useRef } from 'react';
import { createClientOnlyFn } from '@tanstack/react-start';

// Exclude the browser-only notification module from the SSR import graph.
const loadSheetDoorbell = createClientOnlyFn(() => import('@/booking/sheetDoorbell.client'));

/**
 * Calls `onRing` when the Google Sheet finishes a sync (data-free broadcast from the backend).
 * No timers: nothing refreshes unless the sheet was actually edited. The client loads lazily and
 * any failure is swallowed, so a paused backend never breaks the page.
 */
export function useSheetDoorbell(onRing: () => void) {
  const ring = useRef(onRing);
  ring.current = onRing;
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const loading = loadSheetDoorbell();
    if (!loading) return;
    loading
      .then(async ({ createSheetDoorbellClient, subscribeSheetDoorbell }) => {
        if (cancelled) return;
        const client = await createSheetDoorbellClient();
        if (cancelled) return;
        cleanup = subscribeSheetDoorbell(client, () => ring.current());
      })
      .catch(() => {});
    return () => { cancelled = true; cleanup?.(); };
  }, []);
}
