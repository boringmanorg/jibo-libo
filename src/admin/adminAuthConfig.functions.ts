/**
 * Public sign-in settings for the super admin console, read from the server's
 * runtime environment. The live build has no VITE_SUPABASE_* values (the .env file
 * is not committed), so the browser asks the server instead.
 * Only the project URL and the publishable (anon) key are returned; both are public
 * by design and every table stays behind row-level security.
 */
import { createServerFn } from '@tanstack/react-start';

export type AdminAuthConfig = { url: string; publishableKey: string } | { error: string };

export function readAdminAuthConfig(env: Record<string, string | undefined>): AdminAuthConfig {
  const url = env['SUPABASE_URL'] || env['VITE_SUPABASE_URL'];
  const publishableKey = env['SUPABASE_PUBLISHABLE_KEY'] || env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !publishableKey) {
    const missing = [!url && 'SUPABASE_URL', !publishableKey && 'SUPABASE_PUBLISHABLE_KEY'].filter(Boolean).join(', ');
    return { error: `Sign-in service is not configured on the server (missing ${missing}).` };
  }
  return { url, publishableKey };
}

export const getAdminAuthConfig = createServerFn({ method: 'GET' }).handler(async () =>
  readAdminAuthConfig(process.env),
);
