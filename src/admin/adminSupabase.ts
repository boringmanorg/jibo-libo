/**
 * Browser sign-in client for the super admin console only.
 * Guest pages never import this module (they stay on offlineBackend).
 * The project URL and publishable key come from the build when present,
 * otherwise from the server at runtime (see adminAuthConfig.functions.ts).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAdminAuthConfig } from './adminAuthConfig.functions';

export const SUPER_ADMIN_EMAIL = 'admin@xtsy.one';
const SESSION_STORE = 'xtsy-admin-console';
let pending: Promise<SupabaseClient> | null = null;

async function resolveConfig(): Promise<{ url: string; publishableKey: string }> {
  const builtUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const builtKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (builtUrl && builtKey) return { url: builtUrl, publishableKey: builtKey };
  const cfg = await getAdminAuthConfig();
  if ('error' in cfg) throw new Error(cfg.error);
  return cfg;
}

export function getAdminSupabase(): Promise<SupabaseClient> {
  if (!pending) {
    pending = resolveConfig()
      .then(({ url, publishableKey }) =>
        createClient(url, publishableKey, {
          auth: { storageKey: SESSION_STORE, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        }),
      )
      .catch((e) => {
        pending = null; // allow a retry after a failed lookup
        throw e;
      });
  }
  return pending;
}
