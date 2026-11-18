/**
 * Browser sign-in client for the super admin console only.
 * Guest pages never import this module (they stay on offlineBackend).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPER_ADMIN_EMAIL = 'admin@xtsy.one';
let client: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { storageKey: 'xtsy-admin-console', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
