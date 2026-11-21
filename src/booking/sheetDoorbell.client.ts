import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAdminAuthConfig } from '@/admin/adminAuthConfig.functions';

/** Notification-only client: no sessions, identifiers, table reads or writes. */
export async function createSheetDoorbellClient() {
  const config = await getAdminAuthConfig();
  if ('error' in config) throw new Error(config.error);
  const url = import.meta.env.VITE_SUPABASE_URL || config.url;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || config.publishableKey;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function subscribeSheetDoorbell(client: Pick<SupabaseClient, 'channel' | 'removeChannel'>, onRing: () => void) {
  let closed = false;
  const ring = () => { if (!closed) onRing(); };
  const channel = client.channel('sheet-availability')
    .on('broadcast', { event: 'synced' }, ring)
    // Catch up after initial connection or reconnect: an edit may have landed while disconnected.
    .subscribe((status) => { if (status === 'SUBSCRIBED') ring(); });
  return () => { closed = true; void client.removeChannel(channel); };
}