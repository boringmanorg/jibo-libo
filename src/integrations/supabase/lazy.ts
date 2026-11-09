/**
 * Historically this lazy-loaded the ~200 KB Supabase client off the critical path.
 * The site no longer has a database dependency, so it resolves the inert stand-in
 * immediately -- the client is never bundled or fetched at all.
 */
export { getSupabase } from '@/lib/offlineBackend';
