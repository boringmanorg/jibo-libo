/**
 * Console server functions for the channel manager (ZimmerStack). Admin-only (requireSuperAdmin).
 * The admin's session proves who pressed the button; the ZimmerStack key and the service-role
 * database client stay on the server. Every write here is one admin action.
 */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSuperAdmin } from './adminAuth';
import { CHANNEL_PROPERTY_IDS, type ChannelPropertyId } from '@/booking/channel/zimmerstackPlan';
import { todayInIndia } from '@/booking/dates';

type Ctx = { supabase: any; userId: string };
const propertyId = z.enum(CHANNEL_PROPERTY_IDS as unknown as [ChannelPropertyId, ...ChannelPropertyId[]]);
const OTAS = ['bookingcom', 'gommt', 'agoda', 'expedia', 'tripcom', 'yatra', 'hostelworld', 'airbnb'] as const;

async function deps() {
  const { getServiceClient } = await import('./serviceClient.server');
  const db = getServiceClient();
  if (!db) throw new Error('The server database key is missing.');
  return { db, env: process.env, now: new Date() };
}
async function server() {
  return import('@/booking/channel/zimmerstack.server');
}
async function audit(ctx: Ctx, action: string, details: Record<string, unknown>) {
  await ctx.supabase.from('console_audit_log').insert({ action: `channel.${action}`, details });
}
/** Turns a refusal into a message for the admin instead of a crash. */
async function run<T>(fn: () => Promise<T>): Promise<{ ok: true; result: T } | { ok: false; message: string }> {
  try {
    return { ok: true, result: await fn() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Something went wrong.' };
  }
}

export const getChannelOverview = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async () => {
    const s = await server();
    return s.channelOverview(await deps());
  });

export const testChannelConnection = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .handler(async () => {
    const s = await server();
    return s.testConnection(await deps());
  });

export const setChannelProperty = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: propertyId, on: z.boolean() }))
  .handler(async ({ data, context }) => {
    const s = await server();
    const r = await run(async () => s.setEnabled(await deps(), data.id, data.on));
    if (r.ok) await audit(context as Ctx, data.on ? 'on' : 'off', { id: data.id });
    return r;
  });

const owner = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().regex(/^\+?[0-9 ]{8,20}$/, 'Phone with country code, e.g. +91 88373 17070'),
});

export const addChannelHotel = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: propertyId, owner }))
  .handler(async ({ data, context }) => {
    const s = await server();
    const r = await run(async () => s.addHotel(await deps(), data.id, data.owner));
    if (r.ok) await audit(context as Ctx, 'hotel.add', { id: data.id });
    return r;
  });

export const linkChannelHotel = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: propertyId, zsPropertyId: z.number().int().positive().max(1e12) }))
  .handler(async ({ data, context }) => {
    const s = await server();
    const r = await run(async () => s.linkHotel(await deps(), data.id, data.zsPropertyId));
    if (r.ok) await audit(context as Ctx, 'hotel.link', data);
    return r;
  });

const ACTIONS = ['catalog', 'prices', 'counts', 'readiness', 'go_live', 'catch_up'] as const;

export const runChannelAction = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: propertyId, action: z.enum(ACTIONS) }))
  .handler(async ({ data, context }) => {
    const s = await server();
    const d = await deps();
    const r = await run(async () => {
      switch (data.action) {
        case 'catalog': return { kind: 'catalog' as const, ...(await s.sendCatalog(d, data.id)) };
        case 'prices': return { kind: 'write' as const, ...(await s.sendPrices(d, data.id)) };
        case 'counts': return { kind: 'counts' as const, ...(await s.sendAllCounts(d, data.id)) };
        case 'readiness': return { kind: 'readiness' as const, ...(await s.readiness(d, data.id)) };
        case 'go_live': return { kind: 'go_live' as const, ...(await s.goLive(d, data.id)) };
        case 'catch_up': return { kind: 'catch_up' as const, ...(await s.catchUp(d, data.id)) };
      }
    });
    if (data.action !== 'readiness') await audit(context as Ctx, data.action, { id: data.id, ok: r.ok });
    return r;
  });

export const makeOtaConnectLink = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: propertyId, channel: z.enum(OTAS) }))
  .handler(async ({ data, context }) => {
    const s = await server();
    const r = await run(async () => s.connectLink(await deps(), data.id, data.channel));
    if (r.ok) await audit(context as Ctx, 'ota.link', { id: data.id, channel: data.channel });
    return r;
  });

/** OTA bookings for the Inbox (admin RLS read), upcoming first. */
export const listOtaBookings = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const cols = 'zs_booking_id,zs_mode,property_id,status,ota_name,ota_code,check_in,check_out,guest_name,guest_phone,guest_email,contact_withheld,adults,children,total,currency,rooms,received_at';
    const q = (c: string) => ctx.supabase.from('be_ota_bookings').select(c).gte('check_out', todayInIndia(new Date())).order('check_in').limit(200);
    let r = await q(`${cols},sheet_write`);
    if (r.error) r = await q(cols); // before the write-back migration
    return { ready: !r.error, rows: (r.data ?? []) as {
      zs_booking_id: number; zs_mode: string; property_id: string; status: string; ota_name: string | null; ota_code: string | null;
      check_in: string; check_out: string; guest_name: string | null; guest_phone: string | null; guest_email: string | null; contact_withheld: string | null;
      adults: number; children: number; total: number | null; currency: string | null; rooms: { roomTypeId: string; units: number }[]; received_at: string;
      sheet_write?: 'queued' | 'applied' | null;
    }[] };
  });

/** Bookings the Google Sheet could not take (month missing, OVERBOOKED) or has not picked up for 10 minutes. */
export const listSheetWriteIssues = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async () => {
    const { sheetWriteIssues } = await import('@/booking/sheetWrites.server');
    const { db, now } = await deps();
    return sheetWriteIssues(db, now) as Promise<{ enabled: boolean; rows: {
      id: number; source: 'ota' | 'website'; source_ref: string; kind: 'book' | 'cancel'; tag: string; guest_name: string;
      check_in: string; check_out: string; status: string; problem: string | null; created_at: string; applied_at: string | null; nights: number;
    }[] }>;
  });
