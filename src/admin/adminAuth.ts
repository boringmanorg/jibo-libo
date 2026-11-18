/**
 * Function middleware for console server functions: the browser attaches the admin
 * session token, the server re-validates it and requires admin@xtsy.one + admin role.
 */
import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';

export const SUPER_ADMIN = 'admin@xtsy.one';

export const requireSuperAdmin = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    const { getAdminSupabase } = await import('./adminSupabase');
    const { data } = await getAdminSupabase().auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  })
  .server(async ({ next }) => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    const auth = getRequest()?.headers.get('authorization');
    if (!url || !key || !auth?.startsWith('Bearer ')) throw new Error('Unauthorized');
    const token = auth.slice(7);
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (error || !user || user.email?.toLowerCase() !== SUPER_ADMIN || !user.email_confirmed_at) throw new Error('Forbidden');
    const { data: ok } = await supabase.rpc('is_super_admin');
    if (ok !== true) throw new Error('Forbidden');
    return next({ context: { supabase, userId: user.id } });
  });
