/** Refreshes Live insights when a guest moves a step (data-free 'live-insights' broadcast); no timers. */
import { useEffect } from 'react';
import { createClientOnlyFn } from '@tanstack/react-start';

const load = createClientOnlyFn(() => import('@/booking/sheetDoorbell.client'));

export function useLiveDoorbell(onRing: () => void) {
  useEffect(() => {
    let off: (() => void) | undefined;
    let closed = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    const ring = () => { clearTimeout(t); t = setTimeout(onRing, 1500); }; // coalesce bursts
    void load().then(async ({ createSheetDoorbellClient }) => {
      const client = await createSheetDoorbellClient();
      if (closed) return;
      const ch = client.channel('live-insights').on('broadcast', { event: 'moved' }, ring).subscribe((s) => { if (s === 'SUBSCRIBED') ring(); });
      off = () => void client.removeChannel(ch);
    }).catch(() => undefined);
    return () => { closed = true; clearTimeout(t); off?.(); };
  }, [onRing]);
}
