/**
 * Super admin console server functions. Every call is admin-only (requireSuperAdmin).
 * Changes are saved locally first and forwarded to PMS/POS by XTSY only when that
 * connection is switched on in the console and its secrets exist.
 */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { PMS_PROPERTIES, POS_OUTLETS, canonicalPropertyId, findOutlet, findProperty, unitInfo } from '@/integrations/xtsy-saas/catalogue';
import { requireSuperAdmin, requirePropertyAdmin, requireCheckInStaff } from './adminAuth';
import { assertPropertyScope, HOSTEL_ID } from './consoleScope';
import { staticTableSlots } from './slots';
import { closedUnits, closureFromRow, type ClosureRow } from '@/booking/consoleClosures';
import { stayNights } from '@/booking/dates';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
type Ctx = { supabase: any; userId: string; isSuperAdmin: boolean; access?: { propertyId: string; role: 'super' | 'property_admin' | 'front_desk' }[] };
/** Super admin, or staff (admin or front desk) of this property. RLS enforces the same. */
function assertDeskScope(context: unknown, propertyId: string) {
  const c = context as Ctx;
  if (!c.isSuperAdmin && !c.access?.some((a) => a.propertyId === propertyId)) throw new Error('Forbidden: not your property.');
}

async function endpoint() {
  const { getSaasEndpoint, saasRequest } = await import('@/integrations/xtsy-saas/client.server');
  return { cfg: getSaasEndpoint(), saasRequest };
}
async function settings(ctx: Ctx) {
  const { data } = await ctx.supabase.from('console_integration_settings').select('*').eq('id', 1).maybeSingle();
  return data ?? { pms_enabled: false, pos_enabled: false, live_tables_showcase: false, last_pms_sync_at: null, last_pos_sync_at: null };
}
async function audit(ctx: Ctx, action: string, details: Record<string, unknown>) {
  await ctx.supabase.from('console_audit_log').insert({ action, details });
}
/** A block or opening changed some nights: send their new counts to ZimmerStack (properties switched on only). */
async function channelAfterClosure(rooms: { propertyId: string; unitTypeId: string }[], start: string, end: string) {
  try {
    const { getServiceClient } = await import('./serviceClient.server');
    const db = getServiceClient();
    if (!db) return null;
    const { afterClosureChange } = await import('@/booking/channel/zimmerstack.server');
    const res = await afterClosureChange({ db, env: process.env, now: new Date() }, rooms, start, end);
    const parts = Object.values(res);
    const sent = parts.reduce((n, p) => n + p.sent, 0);
    const problem = parts.map((p) => ('error' in p && p.error) || ('rejected' in p && p.rejected?.length ? p.rejected.join('; ') : '')).find(Boolean);
    if (problem) return `ZimmerStack: ${problem}`;
    return sent ? `Sent ${sent} night(s) to ZimmerStack.` : null;
  } catch {
    return null;
  }
}

export const getConsoleOverview = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const { cfg } = await endpoint();
    const [s, inv, tables, log, sheet] = await Promise.all([
      settings(ctx),
      ctx.supabase.from('console_inventory_overrides').select('*').order('start_date'),
      ctx.supabase.from('console_table_overrides').select('*').order('service_date'),
      ctx.supabase.from('console_audit_log').select('*').order('created_at', { ascending: false }).limit(25),
      // Last time the Google Sheet sent availability (the table exists once migration 0018 has run).
      ctx.supabase.from('be_sheet_availability').select('synced_at').order('synced_at', { ascending: false }).limit(1),
    ]);
    return {
      settings: s,
      secretsConfigured: Boolean(cfg),
      accessScope: ctx.isSuperAdmin ? 'super' as const : 'hostel' as const,
      properties: PMS_PROPERTIES.filter((p) => ctx.isSuperAdmin || p.propertyId === HOSTEL_ID).map((p) => ({
        propertyId: p.propertyId, name: p.name, path: p.path,
        units: p.unitTypeIds.map((id) => ({ id, ...unitInfo(id)! })),
      })),
      outlets: (ctx.isSuperAdmin ? POS_OUTLETS : []).map((o) => ({ outletId: o.outletId, name: o.name, path: o.path })),
      // Rows saved under the old separate Experience by XTSY property show with the hostel.
      inventoryOverrides: (inv.data ?? []).map((o: any) => ({ ...o, property_id: canonicalPropertyId(o.property_id) })),
      tableOverrides: tables.data ?? [],
      audit: log.data ?? [],
      sheetSyncedAt: (sheet.data?.[0]?.synced_at as string | undefined) ?? null,
    };
  });

export const setIntegrationFlags = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ pms_enabled: z.boolean().optional(), pos_enabled: z.boolean().optional(), live_tables_showcase: z.boolean().optional() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { error } = await ctx.supabase.from('console_integration_settings').update({ ...data, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) throw new Error('Could not save settings');
    await audit(ctx, 'settings.update', data);
    return { ok: true };
  });

export const testConnection = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ system: z.enum(['pms', 'pos']) }))
  .handler(async ({ data }) => {
    const { cfg, saasRequest } = await endpoint();
    if (!cfg) return { ok: false, message: 'PMS/POS address and access key are not saved yet.' };
    try {
      await saasRequest(cfg, `/${data.system}/v1/status`, { method: 'GET' });
      return { ok: true, message: 'Connected.' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
    }
  });

export const consoleCheckAvailability = createServerFn({ method: 'POST' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ propertyId: z.string().max(40), checkIn: date, checkOut: date, guests: z.number().int().min(1).max(40) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    assertPropertyScope(ctx.isSuperAdmin, data.propertyId);
    if (data.checkOut <= data.checkIn) throw new Error('Check-out must be after check-in');
    const property = findProperty(data.propertyId);
    if (!property) throw new Error('Unknown property');
    const s = await settings(ctx);
    const { cfg, saasRequest } = await endpoint();
    if (s.pms_enabled && cfg) {
      const live = await saasRequest<{ units: { unitTypeId: string; available: number; nightlyRate: number; currency: string }[] }>(cfg, '/pms/v1/availability', { method: 'POST', body: data });
      return { source: 'pms' as const, units: live.units.map((u) => ({ ...u, blocked: false })) };
    }
    // Same rules as the guest booking page: partial blocks add up, a later opening cancels a block.
    const { data: rows } = await ctx.supabase.from('console_inventory_overrides').select('*').in('property_id', [property.propertyId, ...(property.propertyId === 'XTSY-SHL-HOSTEL' ? ['XTSY-SHL-SUITE'] : [])]).order('created_at');
    const closures = (rows ?? []).map(closureFromRow).filter((x: ClosureRow | null): x is ClosureRow => x !== null);
    const nights = stayNights(data.checkIn, data.checkOut);
    return {
      source: 'static' as const,
      units: property.unitTypeIds.map((id) => {
        const total = unitInfo(id)!.totalUnits;
        const available = Math.min(...nights.map((n) => Math.max(0, total - closedUnits(closures, id, n))));
        return { unitTypeId: id, available, nightlyRate: unitInfo(id)!.rate, currency: property.currency, blocked: available === 0 };
      }),
    };
  });

/** Room choices beyond a single room type: every room of the chosen property, or of every property. */
export const WHOLE_PROPERTY = '__property__';
export const ALL_STAYS = '__all_stays__';

export const saveInventoryOverride = createServerFn({ method: 'POST' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({
    propertyId: z.string().max(40), unitTypeId: z.string().max(60), startDate: date, endDate: date, state: z.enum(['blocked', 'open']),
    reason: z.string().max(200).optional(),
    /** Close only this many beds or rooms; leave out to close all of them. Single room type only. */
    units: z.number().int().min(1).max(50).optional(),
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    assertPropertyScope(ctx.isSuperAdmin, data.propertyId);
    const property = findProperty(data.propertyId);
    if (!property) throw new Error('Unknown property');
    if (data.endDate < data.startDate) throw new Error('End date is before start date');
    const targets: { propertyId: string; unitTypeId: string }[] =
      data.unitTypeId === ALL_STAYS ? PMS_PROPERTIES.filter((p) => ctx.isSuperAdmin || p.propertyId === HOSTEL_ID).flatMap((p) => p.unitTypeIds.map((u) => ({ propertyId: p.propertyId, unitTypeId: u })))
      : data.unitTypeId === WHOLE_PROPERTY ? property.unitTypeIds.map((u) => ({ propertyId: property.propertyId, unitTypeId: u }))
      : property.unitTypeIds.includes(data.unitTypeId) ? [{ propertyId: property.propertyId, unitTypeId: data.unitTypeId }]
      : [];
    if (!targets.length) throw new Error('Unknown room');
    const units = targets.length === 1 && data.units ? Math.min(data.units, unitInfo(targets[0].unitTypeId)?.totalUnits ?? data.units) : undefined;
    // `units` is sent only when set, so saving still works before the units column exists.
    const { data: rows, error } = await ctx.supabase.from('console_inventory_overrides').insert(targets.map((t) => ({
      property_id: t.propertyId, unit_type_id: t.unitTypeId, start_date: data.startDate, end_date: data.endDate, state: data.state,
      reason: data.reason ?? null, ...(units ? { units } : {}),
    }))).select();
    if (error || !rows?.length) throw new Error(units ? 'Could not save. If this keeps happening, the database update for partial blocks has not run yet: block all units instead.' : 'Could not save');
    const s = await settings(ctx);
    const { cfg, saasRequest } = await endpoint();
    let pmsStatus = 'pending';
    if (s.pms_enabled && cfg) {
      pmsStatus = 'synced';
      for (const row of rows) {
        try {
          const res = await saasRequest<{ reference: string }>(cfg, '/pms/v1/inventory/overrides', { method: 'POST', body: {
            propertyId: row.property_id, unitTypeId: row.unit_type_id, startDate: data.startDate, endDate: data.endDate, state: data.state, reason: data.reason, ...(units ? { units } : {}),
          } });
          await ctx.supabase.from('console_inventory_overrides').update({ pms_status: 'synced', pms_reference: res.reference }).eq('id', row.id);
        } catch {
          pmsStatus = 'failed';
          await ctx.supabase.from('console_inventory_overrides').update({ pms_status: 'failed' }).eq('id', row.id);
        }
      }
    }
    await audit(ctx, `inventory.${data.state}`, { ...data, rooms: targets.length, pmsStatus });
    const channel = await channelAfterClosure(targets, data.startDate, data.endDate);
    return { id: rows[0].id, saved: rows.length, pmsStatus, channel };
  });

export const deleteInventoryOverride = createServerFn({ method: 'POST' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: row } = await ctx.supabase.from('console_inventory_overrides').select('property_id,unit_type_id,start_date,end_date').eq('id', data.id).maybeSingle();
    await ctx.supabase.from('console_inventory_overrides').delete().eq('id', data.id);
    await audit(ctx, 'inventory.remove', data);
    const channel = row ? await channelAfterClosure([{ propertyId: row.property_id, unitTypeId: row.unit_type_id }], String(row.start_date).slice(0, 10), String(row.end_date).slice(0, 10)) : null;
    return { ok: true, channel };
  });

export const syncRoomsNow = createServerFn({ method: 'POST' })
  .middleware([requirePropertyAdmin])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const s = await settings(ctx);
    const { cfg, saasRequest } = await endpoint();
    if (!s.pms_enabled || !cfg) return { ok: false, message: 'PMS connection is off. Showing your current room list.' };
    const { data: pending } = await ctx.supabase.from('console_inventory_overrides').select('*').neq('pms_status', 'synced');
    let sent = 0;
    for (const p of pending ?? []) {
      try {
        const res = await saasRequest<{ reference: string }>(cfg, '/pms/v1/inventory/overrides', { method: 'POST', body: {
          propertyId: p.property_id, unitTypeId: p.unit_type_id, startDate: p.start_date, endDate: p.end_date, state: p.state, reason: p.reason ?? undefined,
        } });
        await ctx.supabase.from('console_inventory_overrides').update({ pms_status: 'synced', pms_reference: res.reference }).eq('id', p.id);
        sent++;
      } catch {
        await ctx.supabase.from('console_inventory_overrides').update({ pms_status: 'failed' }).eq('id', p.id);
      }
    }
    await ctx.supabase.from('console_integration_settings').update({ last_pms_sync_at: new Date().toISOString() }).eq('id', 1);
    await audit(ctx, 'pms.sync', { sent });
    return { ok: true, message: `Synced with PMS. ${sent} pending change(s) sent.` };
  });

export const listPmsEnquiries = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .handler(async ({ context }) => {
    const s = await settings(context as Ctx);
    const { cfg, saasRequest } = await endpoint();
    if (!s.pms_enabled || !cfg) return { connected: false, items: [] as PmsEnquiryRow[] };
    const res = await saasRequest<{ items: PmsEnquiryRow[] }>(cfg, '/pms/v1/enquiries', { method: 'GET' });
    return { connected: true, items: res.items.filter((r) => (context as Ctx).isSuperAdmin || r.propertyId === HOSTEL_ID) };
  });
export interface PmsEnquiryRow { reference: string; propertyId: string; unitTypeId: string; checkIn: string; checkOut: string; guests: number; guestName: string; status: 'new' | 'held' | 'confirmed' | 'cancelled' }

export const getTableBoard = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ outletId: z.string().max(40), date }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    if (!findOutlet(data.outletId)) throw new Error('Unknown outlet');
    const s = await settings(ctx);
    const { cfg, saasRequest } = await endpoint();
    const { data: overrides } = await ctx.supabase.from('console_table_overrides').select('*').eq('outlet_id', data.outletId).eq('service_date', data.date);
    let free = staticTableSlots();
    let reservations: PosReservationRow[] = [];
    let source: 'pos' | 'static' = 'static';
    if (s.pos_enabled && cfg) {
      const [slots, res] = await Promise.all([
        saasRequest<{ slots: string[] }>(cfg, `/pos/v1/outlets/${data.outletId}/slots?date=${data.date}`, { method: 'GET' }),
        saasRequest<{ items: PosReservationRow[] }>(cfg, `/pos/v1/outlets/${data.outletId}/reservations?date=${data.date}`, { method: 'GET' }),
      ]);
      free = slots.slots; reservations = res.items; source = 'pos';
    }
    const closed = new Set((overrides ?? []).filter((o: any) => o.state === 'closed').map((o: any) => o.slot_time));
    return {
      source,
      slots: staticTableSlots().map((t) => ({ time: t, state: closed.has(t) ? 'closed' : free.includes(t) ? 'free' : 'booked' })),
      reservations,
      overrides: overrides ?? [],
    };
  });
export interface PosReservationRow { reference: string; time: string; service: string; partySize: number; guestName: string; status: string }

export const setTableSlot = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ outletId: z.string().max(40), date, time: z.string().regex(/^\d{2}:\d{2}$/), state: z.enum(['closed', 'open']) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    if (!findOutlet(data.outletId) || !staticTableSlots().includes(data.time)) throw new Error('Outside table service hours');
    const { error } = await ctx.supabase.from('console_table_overrides').upsert(
      { outlet_id: data.outletId, service_date: data.date, slot_time: data.time, state: data.state, pos_status: 'pending' },
      { onConflict: 'outlet_id,service_date,slot_time' },
    );
    if (error) throw new Error('Could not save');
    const s = await settings(ctx);
    const { cfg, saasRequest } = await endpoint();
    let posStatus = 'pending';
    if (s.pos_enabled && cfg) {
      try {
        await saasRequest(cfg, `/pos/v1/outlets/${data.outletId}/slot-overrides`, { method: 'POST', body: data });
        posStatus = 'synced';
      } catch { posStatus = 'failed'; }
      await ctx.supabase.from('console_table_overrides').update({ pos_status: posStatus }).match({ outlet_id: data.outletId, service_date: data.date, slot_time: data.time });
    }
    await audit(ctx, `tables.${data.state}`, { ...data, posStatus });
    return { posStatus };
  });

/** Google Sheets that asked to send availability, newest first (pending ones expire after 30 minutes). */
export const listSheetLinks = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const { data, error } = await ctx.supabase.from('be_sheet_links')
      .select('id,pair_code,label,status,created_at,approved_at,last_sync_at,last_sync_rows').neq('status', 'revoked').order('created_at', { ascending: false }).limit(20);
    const cutoff = Date.now() - 30 * 60_000;
    return { ready: !error, links: (data ?? []).filter((l: any) => l.status !== 'pending' || new Date(l.created_at).getTime() > cutoff) };
  });

/** Approve a sheet's pairing code (only one sheet is active at a time), or reject/disconnect it. */
export const setSheetLink = createServerFn({ method: 'POST' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ id: z.string().uuid(), action: z.enum(['approve', 'revoke']) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    if (data.action === 'approve') {
      const { data: row } = await ctx.supabase.from('be_sheet_links').select('status,created_at').eq('id', data.id).maybeSingle();
      if (!row || row.status !== 'pending' || Date.now() - new Date(row.created_at).getTime() > 30 * 60_000) throw new Error('This pairing request has expired. Connect again from the sheet.');
      await ctx.supabase.from('be_sheet_links').update({ status: 'revoked' }).eq('status', 'active');
      const { error } = await ctx.supabase.from('be_sheet_links').update({ status: 'active', approved_at: new Date().toISOString() }).eq('id', data.id);
      if (error) throw new Error('Could not approve');
    } else {
      const { error } = await ctx.supabase.from('be_sheet_links').update({ status: 'revoked' }).eq('id', data.id);
      if (error) throw new Error('Could not disconnect');
    }
    await audit(ctx, `sheet.${data.action}`, { id: data.id });
    return { ok: true };
  });

/**
 * Desk allocates exact beds/rooms to a self check-in. Holds that many units of the room type on
 * every night of the stay as a console block (same path as Stays → Block), so /book, the console
 * and ZimmerStack all count them as taken. Re-allocating replaces the previous hold.
 */
export const allocateCheckInRooms = createServerFn({ method: 'POST' })
  .middleware([requireCheckInStaff])
  .inputValidator(z.object({ id: z.string().uuid(), roomTypeId: z.string().max(60), units: z.array(z.string().max(12)).min(1).max(40), checkOut: date }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { validateAllocation, lastNight } = await import('@/checkin/allocation');
    const { data: row } = await ctx.supabase.from('be_self_check_ins').select('*').eq('id', data.id).maybeSingle();
    if (!row) throw new Error('Check-in not found.');
    if (row.property_id !== HOSTEL_ID) throw new Error('Room allocation is for the hostel only.');
    assertDeskScope(context, row.property_id);
    const { data: others } = await ctx.supabase.from('be_self_check_ins').select('id,allocated_room_type_id,allocated_units,check_in_date,check_out_date')
      .eq('property_id', row.property_id).not('allocated_room_type_id', 'is', null).gte('check_out_date', row.check_in_date);
    const allocs = (others ?? []).map((o: any) => ({ id: o.id, roomTypeId: o.allocated_room_type_id, units: o.allocated_units ?? [], checkIn: o.check_in_date, checkOut: o.check_out_date }));
    validateAllocation({ roomTypeId: data.roomTypeId, units: data.units, guests: Number(row.total_guests), checkIn: row.check_in_date, checkOut: data.checkOut }, allocs, row.id);
    const affected: { propertyId: string; unitTypeId: string }[] = [{ propertyId: HOSTEL_ID, unitTypeId: data.roomTypeId }];
    if (row.allocation_override_id) {
      await ctx.supabase.from('console_inventory_overrides').delete().eq('id', row.allocation_override_id);
      if (row.allocated_room_type_id && row.allocated_room_type_id !== data.roomTypeId) affected.push({ propertyId: HOSTEL_ID, unitTypeId: row.allocated_room_type_id });
    }
    const units = [...new Set(data.units)];
    const { ENGINE_ROOM_ID } = await import('@/data/publicRates');
    const consoleId = Object.entries(ENGINE_ROOM_ID).find(([, e]) => e === data.roomTypeId)?.[0] ?? data.roomTypeId;
    const { data: hold, error } = await ctx.supabase.from('console_inventory_overrides').insert({
      property_id: HOSTEL_ID, unit_type_id: consoleId, start_date: row.check_in_date, end_date: lastNight(data.checkOut),
      state: 'blocked', units: units.length, reason: `Check-in ${row.guest_name} · ${units.join(', ')}`,
    }).select('id').single();
    if (error || !hold) throw new Error('Could not hold the rooms. Nothing was changed.');
    const { error: upd } = await ctx.supabase.from('be_self_check_ins').update({
      check_out_date: data.checkOut, allocated_room_type_id: data.roomTypeId, allocated_units: units,
      allocation_override_id: hold.id, allocated_at: new Date().toISOString(), status: 'checked_in',
    }).eq('id', row.id);
    if (upd) { await ctx.supabase.from('console_inventory_overrides').delete().eq('id', hold.id); throw new Error('Could not save the allocation.'); }
    await audit(ctx, 'checkin.allocate', { id: row.id, roomTypeId: data.roomTypeId, units, checkOut: data.checkOut });
    const prevEnd = row.check_out_date && row.check_out_date > data.checkOut ? row.check_out_date : data.checkOut;
    const channel = await channelAfterClosure(affected, row.check_in_date, lastNight(prevEnd));
    return { ok: true, channel };
  });

export const releaseCheckInRooms = createServerFn({ method: 'POST' })
  .middleware([requireCheckInStaff])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { lastNight } = await import('@/checkin/allocation');
    const { data: row } = await ctx.supabase.from('be_self_check_ins').select('*').eq('id', data.id).maybeSingle();
    if (!row) throw new Error('Check-in not found.');
    assertDeskScope(context, row.property_id);
    if (row.allocation_override_id) await ctx.supabase.from('console_inventory_overrides').delete().eq('id', row.allocation_override_id);
    await ctx.supabase.from('be_self_check_ins').update({ allocated_room_type_id: null, allocated_units: [], allocation_override_id: null, allocated_at: null }).eq('id', row.id);
    await audit(ctx, 'checkin.release', { id: row.id });
    const channel = row.allocated_room_type_id && row.check_out_date
      ? await channelAfterClosure([{ propertyId: HOSTEL_ID, unitTypeId: row.allocated_room_type_id }], row.check_in_date, lastNight(row.check_out_date)) : null;
    return { ok: true, channel };
  });

/** Property admin or super admin: permanently delete an unallocated check-in and its private documents. */
export const deleteCheckIn = createServerFn({ method: 'POST' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: row, error } = await ctx.supabase.from('be_self_check_ins').select(
      'id,property_id,guest_name,allocation_override_id,allocated_units,id_front_path,id_back_path,visa_path,selfie_path,guest_documents',
    ).eq('id', data.id).maybeSingle();
    if (error) throw new Error('Could not verify the check-in.');
    if (!row) throw new Error('Check-in not found.');
    assertDeskScope(context, row.property_id);
    const role = ctx.isSuperAdmin ? 'super' : ctx.access?.find((a) => a.propertyId === row.property_id)?.role ?? 'front_desk';
    const { checkInDeletionProblem } = await import('@/checkin/checkInDeletion');
    const problem = checkInDeletionProblem(
      { allocatedUnits: row.allocated_units ?? [], allocationOverrideId: row.allocation_override_id }, role,
    );
    if (problem) throw new Error(problem);

    const { documentPaths } = await import('@/checkin/checkIn.server');
    const paths = Object.values(documentPaths(row));
    if (paths.length) {
      const removed = await ctx.supabase.storage.from('guest-identity-documents').remove(paths);
      if (removed.error) throw new Error('Could not delete the private documents. The check-in was kept; please try again.');
    }
    const deleted = await ctx.supabase.from('be_self_check_ins').delete().eq('id', row.id);
    if (deleted.error) throw new Error('Could not delete the check-in.');
    await audit(ctx, 'checkin.delete', { id: row.id, propertyId: row.property_id });
    return { ok: true };
  });

/** Smart pricing limits per hostel room type (super admin only). Off until switched on. */
export const getSmartPricing = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const { data, error } = await ctx.supabase.from('be_smart_pricing').select('*');
    if (error) throw new Error('Could not load smart pricing.');
    return (data ?? []).map((r: any) => ({ roomTypeId: r.room_type_id as string, enabled: !!r.enabled, minRupees: Number(r.min_rupees), maxRupees: Number(r.max_rupees) }));
  });

export const saveSmartPricing = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ roomTypeId: z.string().max(60), enabled: z.boolean(), minRupees: z.number().int().min(1).max(100000), maxRupees: z.number().int().min(1).max(100000) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { BOOKING_ROOM_TYPES } = await import('@/booking/catalogue');
    if (!BOOKING_ROOM_TYPES.some((r) => r.id === data.roomTypeId)) throw new Error('Unknown room type.');
    if (data.maxRupees < data.minRupees) throw new Error('Highest price must be at least the lowest price.');
    const { error } = await ctx.supabase.from('be_smart_pricing').upsert({ room_type_id: data.roomTypeId, enabled: data.enabled, min_rupees: data.minRupees, max_rupees: data.maxRupees, updated_at: new Date().toISOString() });
    if (error) throw new Error('Could not save smart pricing.');
    await audit(ctx, 'pricing.smart', data);
    return { ok: true };
  });

/** Latest search-demand reading per property (super admin or property admin). */
export const getSearchDemand = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const { data, error } = await ctx.supabase.from('be_demand_snapshots').select('*').order('captured_at', { ascending: false }).limit(20);
    if (error) throw new Error('Could not load search demand.');
    const { decodeDemandDetails } = await import('./demandTrends');
    const latest: Record<string, any> = {};
    for (const r of data ?? []) if (!latest[r.property_id]) latest[r.property_id] = r;
    return Object.values(latest).map((r: any) => ({
      propertyId: r.property_id as string, windowEnd: r.window_end as string, capturedAt: r.captured_at as string,
      recentImpressions: r.recent_impressions as number, baselineWeekly: r.baseline_weekly as number,
      ratio: Number(r.ratio), multiplier: Number(r.multiplier), topQueries: decodeDemandDetails(r.top_queries).queries, daily: decodeDemandDetails(r.top_queries).daily,
    }));
  });

/** Super admin presses refresh: read Google search appearances and store one reading per property. */
export const refreshSearchDemand = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const { fetchSearchRows } = await import('./searchDemand.server');
    const { readDemand } = await import('@/booking/demandIntent');
    const { dailyDemand } = await import('./demandTrends');
    const { rows, windowEnd } = await fetchSearchRows(new Date());
    const readings = readDemand(rows, windowEnd);
    const { getServiceClient } = await import('./serviceClient.server');
    const db = getServiceClient();
    if (!db) throw new Error('The console server is not configured.');
    const { error } = await db.from('be_demand_snapshots').insert(readings.map((r) => ({
      property_id: r.propertyId, window_end: windowEnd, recent_impressions: r.recentImpressions, baseline_weekly: r.baselineWeekly,
      ratio: r.ratio, multiplier: r.multiplier, top_queries: { queries: r.topQueries, daily: dailyDemand(rows, r.propertyId, windowEnd) },
    })));
    if (error) throw new Error('Could not save the reading.');
    await audit(ctx, 'pricing.demand_refresh', { windowEnd, rows: rows.length });
    return { ok: true, rows: rows.length };
  });
