/**
 * Super admin console server functions. Every call is admin-only (requireSuperAdmin).
 * Changes are saved locally first and forwarded to PMS/POS by XTSY only when that
 * connection is switched on in the console and its secrets exist.
 */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ROOM_TYPES } from '@/config/roomTypes';
import { PMS_PROPERTIES, POS_OUTLETS, findOutlet, findProperty } from '@/integrations/xtsy-saas/catalogue';
import { requireSuperAdmin } from './adminAuth';
import { rangeHitsBlock, staticTableSlots } from './slots';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
type Ctx = { supabase: any; userId: string };

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

export const getConsoleOverview = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const { cfg } = await endpoint();
    const [s, inv, tables, log] = await Promise.all([
      settings(ctx),
      ctx.supabase.from('console_inventory_overrides').select('*').order('start_date'),
      ctx.supabase.from('console_table_overrides').select('*').order('service_date'),
      ctx.supabase.from('console_audit_log').select('*').order('created_at', { ascending: false }).limit(25),
    ]);
    return {
      settings: s,
      secretsConfigured: Boolean(cfg),
      properties: PMS_PROPERTIES.map((p) => ({
        propertyId: p.propertyId, name: p.name, path: p.path,
        units: p.unitTypeIds.map((id) => ({ id, name: ROOM_TYPES[id].name, rate: ROOM_TYPES[id].basePrice, totalUnits: ROOM_TYPES[id].totalUnits })),
      })),
      outlets: POS_OUTLETS.map((o) => ({ outletId: o.outletId, name: o.name, path: o.path })),
      inventoryOverrides: inv.data ?? [],
      tableOverrides: tables.data ?? [],
      audit: log.data ?? [],
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
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ propertyId: z.string().max(40), checkIn: date, checkOut: date, guests: z.number().int().min(1).max(40) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    if (data.checkOut <= data.checkIn) throw new Error('Check-out must be after check-in');
    const property = findProperty(data.propertyId);
    if (!property) throw new Error('Unknown property');
    const s = await settings(ctx);
    const { cfg, saasRequest } = await endpoint();
    if (s.pms_enabled && cfg) {
      const live = await saasRequest<{ units: { unitTypeId: string; available: number; nightlyRate: number; currency: string }[] }>(cfg, '/pms/v1/availability', { method: 'POST', body: data });
      return { source: 'pms' as const, units: live.units.map((u) => ({ ...u, blocked: false })) };
    }
    const { data: blocks } = await ctx.supabase.from('console_inventory_overrides').select('*').eq('property_id', property.propertyId).eq('state', 'blocked');
    return {
      source: 'static' as const,
      units: property.unitTypeIds.map((id) => {
        const blocked = (blocks ?? []).some((b: any) => b.unit_type_id === id && rangeHitsBlock(data.checkIn, data.checkOut, b.start_date, b.end_date));
        return { unitTypeId: id, available: blocked ? 0 : ROOM_TYPES[id].totalUnits, nightlyRate: ROOM_TYPES[id].basePrice, currency: property.currency, blocked };
      }),
    };
  });

export const saveInventoryOverride = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ propertyId: z.string().max(40), unitTypeId: z.string().max(60), startDate: date, endDate: date, state: z.enum(['blocked', 'open']), reason: z.string().max(200).optional() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const property = findProperty(data.propertyId);
    if (!property || !property.unitTypeIds.includes(data.unitTypeId)) throw new Error('Unknown room');
    if (data.endDate < data.startDate) throw new Error('End date is before start date');
    const { data: row, error } = await ctx.supabase.from('console_inventory_overrides').insert({
      property_id: data.propertyId, unit_type_id: data.unitTypeId, start_date: data.startDate, end_date: data.endDate, state: data.state, reason: data.reason ?? null,
    }).select().single();
    if (error) throw new Error('Could not save');
    const s = await settings(ctx);
    const { cfg, saasRequest } = await endpoint();
    let pmsStatus = 'pending';
    if (s.pms_enabled && cfg) {
      try {
        const res = await saasRequest<{ reference: string }>(cfg, '/pms/v1/inventory/overrides', { method: 'POST', body: data });
        pmsStatus = 'synced';
        await ctx.supabase.from('console_inventory_overrides').update({ pms_status: 'synced', pms_reference: res.reference }).eq('id', row.id);
      } catch {
        pmsStatus = 'failed';
        await ctx.supabase.from('console_inventory_overrides').update({ pms_status: 'failed' }).eq('id', row.id);
      }
    }
    await audit(ctx, `inventory.${data.state}`, { ...data, pmsStatus });
    return { id: row.id, pmsStatus };
  });

export const deleteInventoryOverride = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await ctx.supabase.from('console_inventory_overrides').delete().eq('id', data.id);
    await audit(ctx, 'inventory.remove', data);
    return { ok: true };
  });

export const syncRoomsNow = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
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
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => {
    const s = await settings(context as Ctx);
    const { cfg, saasRequest } = await endpoint();
    if (!s.pms_enabled || !cfg) return { connected: false, items: [] as PmsEnquiryRow[] };
    const res = await saasRequest<{ items: PmsEnquiryRow[] }>(cfg, '/pms/v1/enquiries', { method: 'GET' });
    return { connected: true, items: res.items };
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
