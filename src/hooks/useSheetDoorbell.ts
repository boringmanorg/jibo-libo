import { useEffect, useRef } from 'react';

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
    import('@/integrations/supabase/client')
      .then(({ supabase }) => {
        if (cancelled) return;
        const channel = supabase
          .channel('sheet-availability')
          .on('broadcast', { event: 'synced' }, () => ring.current())
          .subscribe();
        cleanup = () => { void supabase.removeChannel(channel); };
      })
      .catch(() => {});
    return () => { cancelled = true; cleanup?.(); };
  }, []);
}
