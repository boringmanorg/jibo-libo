/** Live insights for the console: booking-page steps per property, and the WhatsApp numbers of guests who contacted. */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requirePropertyAdmin } from './adminAuth';
import { canManageProperty } from './consoleScope';
import { summarizeLive, type LiveRow, type PropertyFunnel } from './liveInsights';

type Ctx = { supabase: any; isSuperAdmin: boolean };
export const LIVE_PROPERTIES: Record<string, string> = { 'XTSY-SHL-HOSTEL': 'XTSY Travellers Hostel, New Shillong', 'XTSY-SHN-CAMP': 'Shnonpedeng Riverside Camping by XTSY' };

export const getLiveInsights = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data, context }): Promise<{ at: string; truncated: boolean; properties: (PropertyFunnel & { name: string; contacts: { reference: string; name: string; phone: string; status: string }[] })[] }> => {
    const ctx = context as Ctx;
    const from = new Date(`${data.since}T00:00:00+05:30`).toISOString();
    const LIMIT = 10_000;
    const { data: raw, error } = await ctx.supabase.from('be_live_events').select('session_id,property_id,stage,reference,created_at').gte('created_at', from).order('created_at', { ascending: false }).limit(LIMIT);
    if (error) throw new Error('Could not load live insights.');
    const rows: LiveRow[] = (raw ?? []).filter((r: any) => canManageProperty(ctx.isSuperAdmin, r.property_id))
      .map((r: any) => ({ session: r.session_id, propertyId: r.property_id, stage: r.stage, at: r.created_at, reference: r.reference }));
    const known = Object.keys(LIVE_PROPERTIES).filter((p) => canManageProperty(ctx.isSuperAdmin, p));
    const funnels = summarizeLive(rows, Date.now(), known);
    const refs = funnels.flatMap((f) => f.contactedRefs);
    const enq = refs.length ? await ctx.supabase.from('be_enquiries').select('reference,guest_name,guest_phone,status').in('reference', refs) : { data: [] };
    const byRef = new Map((enq.data ?? []).map((e: any) => [e.reference, e]));
    return {
      at: new Date().toISOString(), truncated: (raw ?? []).length >= LIMIT,
      properties: funnels.map((f) => ({ ...f, name: LIVE_PROPERTIES[f.propertyId] ?? f.propertyId, contacts: f.contactedRefs.map((r) => { const e: any = byRef.get(r); return { reference: r, name: e?.guest_name ?? '', phone: e?.guest_phone ?? '', status: e?.status ?? 'not saved' }; }) })),
    };
  });
