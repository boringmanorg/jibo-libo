/**
 * Function middleware for console server functions: the browser attaches the admin
 * session token, the server re-validates it and requires admin@xtsy.one + admin role.
 */
import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';

export const SUPER_ADMIN = 'admin@xtsy.one';
export const FRONT_DESK = 'booking@xtsy.one';

export const requireSuperAdmin = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    const { getAdminSupabase } = await import('./adminSupabase');
    const { data } = await (await getAdminSupabase()).auth.getSession();
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
    return next({ context: { supabase, userId: user.id, isSuperAdmin: true } });
  });

export type StaffRole = 'super' | 'property_admin' | 'front_desk';
export type StaffAccess = { propertyId: string; role: StaffRole }[];

const attachToken = async ({ next }: { next: (o: { headers: Record<string, string> }) => any }) => {
  const { getAdminSupabase } = await import('./adminSupabase');
  const { data } = await (await getAdminSupabase()).auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
};

/** Verifies the bearer token and reads the user's console access from the database (be_property_staff). */
async function verifyStaff() {
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
  if (error || !user || !user.email_confirmed_at) throw new Error('Forbidden');
  const { data: rows } = await supabase.rpc('be_my_console_access');
  const access: StaffAccess = ((rows ?? []) as { property_id: string; role: StaffRole }[]).map((r) => ({ propertyId: r.property_id, role: r.role }));
  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN && access.some((a) => a.role === 'super');
  if (!access.length) throw new Error('Forbidden');
  return { supabase, userId: user.id, isSuperAdmin, access };
}

/** Anyone with console access: super admin, a property admin or front desk (check-in screens). */
export const requireCheckInStaff = createMiddleware({ type: 'function' })
  .client(attachToken)
  .server(async ({ next }) => next({ context: await verifyStaff() }));

/**
 * Super admin or the hostel's property admin. Front desk is refused. Hostel-scoped operations
 * (assertPropertyScope) assume property admins belong to XTSY Travellers Hostel, so admins of
 * other properties are refused here until those properties have console operations.
 */
export const requirePropertyAdmin = createMiddleware({ type: 'function' })
  .client(attachToken)
  .server(async ({ next }) => {
    const ctx = await verifyStaff();
    if (!ctx.isSuperAdmin && !ctx.access.some((a) => a.role === 'property_admin' && a.propertyId === 'XTSY-SHL-HOSTEL')) throw new Error('Forbidden: property admin access needed.');
    return next({ context: ctx });
  });
