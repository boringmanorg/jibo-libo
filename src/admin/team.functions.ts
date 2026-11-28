/**
 * Console team per property. The super admin manages everyone; the hostel's property admin
 * manages front-desk logins of the hostel only. Accounts are internal @xtsy.one emails with a
 * first password set here; passwords are changed only here, by the property admin or super admin.
 */
import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { z } from 'zod';
import { requireSuperAdmin, SUPER_ADMIN } from './adminAuth';
import { canManageMember, isInternalEmail, TEAM_PROPERTIES, type TeamRole } from './teamRules';

type Ctx = { supabase: any; userId: string; isSuperAdmin: boolean };
const propertyId = z.enum(TEAM_PROPERTIES);
const password = z.string().min(10, 'Use at least 10 characters.').max(72);

async function service() {
  const { getServiceClient } = await import('./serviceClient.server');
  const db = getServiceClient();
  if (!db) throw new Error('The console server is not configured. Nothing was changed.');
  return db;
}
async function memberFor(ctx: Ctx, id: string) {
  const db = await service();
  const { data } = await db.from('be_property_staff').select('*').eq('id', id).maybeSingle();
  if (!data || !canManageMember(ctx.isSuperAdmin, data.property_id, data.role as TeamRole)) throw new Error('You cannot change this login.');
  return { db, member: data };
}
async function audit(ctx: Ctx, action: string, details: Record<string, unknown>) {
  await ctx.supabase.from('console_audit_log').insert({ action, details });
}

export const listTeam = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const ctx = context as Ctx;
    const db = await service();
    let q = db.from('be_property_staff').select('id,user_id,property_id,role,email,display_name,active,created_at').order('created_at');
    if (!ctx.isSuperAdmin) q = q.eq('property_id', 'XTSY-SHL-HOSTEL');
    const [{ data: members }, { data: profiles }] = await Promise.all([q, db.from('be_property_profiles').select('property_id,desk_logins_enabled')]);
    const deskLogins = Object.fromEntries(TEAM_PROPERTIES.map((p) => [p, (profiles ?? []).find((r: any) => r.property_id === p)?.desk_logins_enabled ?? true]));
    return {
      isSuperAdmin: ctx.isSuperAdmin,
      deskLogins,
      members: (members ?? []).map((m: any) => ({ id: m.id, propertyId: m.property_id, role: m.role as TeamRole, email: m.email, name: m.display_name ?? '', active: m.active, isMe: m.user_id === ctx.userId, canManage: m.user_id !== ctx.userId && canManageMember(ctx.isSuperAdmin, m.property_id, m.role) })),
    };
  });

export const createTeamMember = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ propertyId, role: z.enum(['property_admin', 'front_desk']), email: z.string().trim().toLowerCase().email().max(120), name: z.string().trim().max(80), password }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    if (!isInternalEmail(data.email) || data.email === SUPER_ADMIN) throw new Error('Use an internal @xtsy.one email (not admin@xtsy.one).');
    if (!canManageMember(ctx.isSuperAdmin, data.propertyId, data.role)) throw new Error(ctx.isSuperAdmin ? 'Property admins are available for XTSY Travellers Hostel only for now.' : 'You can add front-desk logins for XTSY Travellers Hostel only.');
    const db = await service();
    const { data: made, error } = await db.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true, user_metadata: { console_name: data.name } });
    if (error || !made.user) throw new Error(/already/i.test(error?.message ?? '') ? 'A login with this email already exists.' : 'Could not create the login. Nothing was changed.');
    const { error: rowErr } = await db.from('be_property_staff').insert({ user_id: made.user.id, property_id: data.propertyId, role: data.role, email: data.email, display_name: data.name || null, created_by: ctx.userId });
    if (rowErr) { await db.auth.admin.deleteUser(made.user.id); throw new Error('Could not save the login. Nothing was changed.'); }
    await audit(ctx, 'team.create', { email: data.email, propertyId: data.propertyId, role: data.role });
    return { ok: true };
  });

export const setTeamMemberActive = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { db, member } = await memberFor(ctx, data.id);
    if (member.user_id === ctx.userId) throw new Error('You cannot switch off your own login.');
    await db.from('be_property_staff').update({ active: data.active, updated_at: new Date().toISOString() }).eq('id', member.id);
    // Off also ends any open session straight away.
    await db.auth.admin.updateUserById(member.user_id, { ban_duration: data.active ? 'none' : '876000h' });
    await audit(ctx, data.active ? 'team.enable' : 'team.disable', { email: member.email });
    return { ok: true };
  });

export const setTeamMemberPassword = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: z.string().uuid(), password }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { db, member } = await memberFor(ctx, data.id);
    const { error } = await db.auth.admin.updateUserById(member.user_id, { password: data.password });
    if (error) throw new Error('Could not change the password.');
    await audit(ctx, 'team.password', { email: member.email });
    return { ok: true };
  });

export const setDeskLogins = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ propertyId, enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    if (!canManageMember(ctx.isSuperAdmin, data.propertyId, 'front_desk')) throw new Error('You cannot change this property.');
    const db = await service();
    const { data: existing } = await db.from('be_property_profiles').select('property_id').eq('property_id', data.propertyId).maybeSingle();
    const { error } = existing
      ? await db.from('be_property_profiles').update({ desk_logins_enabled: data.enabled }).eq('property_id', data.propertyId)
      : await db.from('be_property_profiles').insert({ property_id: data.propertyId, desk_logins_enabled: data.enabled });
    if (error) throw new Error('Could not save the switch.');
    await audit(ctx, data.enabled ? 'team.desk_on' : 'team.desk_off', { propertyId: data.propertyId });
    return { ok: true };
  });
