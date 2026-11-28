/** Live insights for the console: booking-page steps per property (counted in the database), and the WhatsApp numbers of guests who contacted. */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requirePropertyAdmin, requireSuperAdmin } from './adminAuth';
import { canManageProperty } from './consoleScope';
import { ACTIVE_MINUTES, DROP_MINUTES, RETAIN_DAYS, type PropertyFunnel } from './liveInsights';
import type { Database } from '@/integrations/supabase/types';

type FunnelRow = Database['public']['Functions']['be_live_funnel']['Returns'][number];
type EnquiryRow = Pick<Database['public']['Tables']['be_enquiries']['Row'], 'reference' | 'guest_name' | 'guest_phone' | 'status'>;
type Ctx = { supabase: { rpc: (fn: 'be_live_funnel', args: { p_since: string; p_active_min: number; p_drop_min: number }) => PromiseLike<{ data: FunnelRow[] | null; error: unknown }>; from: (t: 'be_enquiries') => any }; isSuperAdmin: boolean };
export const LIVE_PROPERTIES: Record<string, string> = { 'XTSY-SHL-HOSTEL': 'XTSY Travellers Hostel, New Shillong', 'XTSY-SHN-CAMP': 'Shnonpedeng Riverside Camping by XTSY' };
export type LiveContact = { reference: string; name: string; phone: string; status: string };

export const getLiveInsights = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data, context }): Promise<{ at: string; properties: (PropertyFunnel & { name: string; contacts: LiveContact[] })[] }> => {
    const ctx = context as unknown as Ctx;
    const from = new Date(`${data.since}T00:00:00+05:30`).toISOString();
    const { data: rows, error } = await ctx.supabase.rpc('be_live_funnel', { p_since: from, p_active_min: ACTIVE_MINUTES, p_drop_min: DROP_MINUTES });
    if (error) throw new Error('Could not load live insights.');
    const byProp = new Map((rows ?? []).filter((r) => canManageProperty(ctx.isSuperAdmin, r.property_id)).map((r) => [r.property_id, r]));
    const ids = [...new Set([...Object.keys(LIVE_PROPERTIES).filter((p) => canManageProperty(ctx.isSuperAdmin, p)), ...byProp.keys()])];
    const refs = [...byProp.values()].flatMap((r) => r.refs ?? []);
    const enq: { data: EnquiryRow[] | null } = refs.length ? await ctx.supabase.from('be_enquiries').select('reference,guest_name,guest_phone,status').in('reference', refs) : { data: [] };
    const byRef = new Map((enq.data ?? []).map((e) => [e.reference, e]));
    return {
      at: new Date().toISOString(),
      properties: ids.map((propertyId) => {
        const r = byProp.get(propertyId);
        const contactedRefs = r?.refs ?? [];
        return {
          propertyId, name: LIVE_PROPERTIES[propertyId] ?? propertyId, contactedRefs,
          now: { viewing: r?.viewing_now ?? 0, rooms: r?.rooms_now ?? 0, details: r?.details_now ?? 0 },
          period: { visits: r?.visits ?? 0, rooms: r?.chose_rooms ?? 0, details: r?.reached_details ?? 0, contacted: r?.contacted ?? 0, dropped: r?.dropped ?? 0 },
          contacts: contactedRefs.map((ref) => { const e = byRef.get(ref); return { reference: ref, name: e?.guest_name ?? '', phone: e?.guest_phone ?? '', status: e?.status ?? 'not saved' }; }),
        };
      }),
    };
  });

/** Owner-pressed clean-up: deletes step rows older than RETAIN_DAYS. Never scheduled. */
export const purgeOldLiveEvents = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .handler(async (): Promise<{ deleted: number }> => {
    const { getServiceClient } = await import('./serviceClient.server');
    const db = getServiceClient();
    if (!db) throw new Error('Clean-up is not available on this server.');
    const cutoff = new Date(Date.now() - RETAIN_DAYS * 86_400_000).toISOString();
    const { count, error } = await db.from('be_live_events').delete({ count: 'exact' }).lt('created_at', cutoff);
    if (error) throw new Error('Could not clean up old entries.');
    return { deleted: count ?? 0 };
  });
