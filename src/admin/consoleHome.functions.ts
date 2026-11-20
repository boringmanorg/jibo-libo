/**
 * Server functions for the redesigned console: Today, Inventory calendar and Inbox.
 * Admin-only (requireSuperAdmin). Reads use the signed-in admin's client, so RLS applies.
 */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSuperAdmin } from './adminAuth';
import { buildCalendar, totals } from './inventoryCalendar';
import { activitySentence } from './activityText';
import { closureFromRow, type ClosureRow } from '@/booking/consoleClosures';
import { addDays, todayInIndia, type IsoDate } from '@/booking/dates';
import type { SheetAvailability } from '@/booking/sheetAvailability';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
type Ctx = { supabase: any; userId: string };

async function loadSheet(ctx: Ctx, from: IsoDate, to: IsoDate) {
  const out: SheetAvailability = {};
  let active = false;
  const any = await ctx.supabase.from('be_sheet_availability').select('synced_at').order('synced_at', { ascending: false }).limit(1);
  const syncedAt: string | null = any.data?.[0]?.synced_at ?? null;
  if (!any.error && syncedAt) active = true;
  for (let page = 0; active && page < 10; page++) {
    const r = await ctx.supabase.from('be_sheet_availability').select('room_type_id,night,free').gte('night', from).lt('night', to).range(page * 1000, page * 1000 + 999);
    if (r.error) break;
    for (const row of r.data ?? []) (out[row.room_type_id] ??= {})[String(row.night).slice(0, 10) as IsoDate] = row.free;
    if ((r.data ?? []).length < 1000) break;
  }
  // Sheet synced but nothing in this window: keep it "active" so the calendar shows those nights as not bookable.
  if (active && Object.keys(out).length === 0) out['__synced__'] = {};
  return { sheet: out, syncedAt };
}

async function loadClosures(ctx: Ctx, from: IsoDate, to: IsoDate): Promise<ClosureRow[]> {
  const r = await ctx.supabase.from('console_inventory_overrides').select('*').gte('end_date', from).lte('start_date', to).order('created_at');
  return (r.data ?? []).map(closureFromRow).filter((x: ClosureRow | null): x is ClosureRow => x !== null);
}

export const getInventoryCalendar = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ start: date, days: z.number().int().min(1).max(62) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const start = data.start as IsoDate;
    const end = addDays(start, data.days);
    const [{ sheet, syncedAt }, closures] = await Promise.all([loadSheet(ctx, start, end), loadClosures(ctx, start, addDays(end, -1))]);
    return { start, days: data.days, today: todayInIndia(new Date()), sheetSyncedAt: syncedAt, rows: buildCalendar(start, data.days, sheet, closures) };
  });

export const getTodaySummary = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const today = todayInIndia(new Date());
    const end = addDays(today, 14);
    const [{ sheet, syncedAt }, closures, enq, newCount, log] = await Promise.all([
      loadSheet(ctx, today, end),
      loadClosures(ctx, today, end),
      ctx.supabase.from('be_enquiries').select('id,reference,kind,guest_name,check_in,check_out,guests,estimate_rupees,status,created_at').order('created_at', { ascending: false }).limit(6),
      ctx.supabase.from('be_enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      ctx.supabase.from('console_audit_log').select('id,action,details,created_at').order('created_at', { ascending: false }).limit(12),
    ]);
    const rows = buildCalendar(today, 14, sheet, closures);
    return {
      today,
      sheetSyncedAt: syncedAt,
      rows,
      tonight: totals(rows, 0),
      week: Array.from({ length: 14 }, (_, i) => ({ night: addDays(today, i), ...totals(rows, i) })),
      activeBlocks: closures.filter((c) => c.state === 'blocked').length,
      inboxReady: !enq.error,
      newEnquiries: newCount.count ?? 0,
      latestEnquiries: enq.data ?? [],
      activity: (log.data ?? []).map((a: any) => ({ id: a.id, at: a.created_at, text: activitySentence(a.action, a.details) })),
    };
  });

const STATUS = z.enum(['new', 'contacted', 'confirmed', 'lost']);

export const listInbox = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ status: STATUS.optional(), search: z.string().trim().max(60).optional() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    let q = ctx.supabase.from('be_enquiries').select('*').order('created_at', { ascending: false }).limit(200);
    if (data.status) q = q.eq('status', data.status);
    if (data.search) {
      const s = data.search.replace(/[%,()]/g, ' ');
      q = q.or(`guest_name.ilike.%${s}%,guest_phone.ilike.%${s}%,reference.ilike.%${s}%`);
    }
    const [enq, counts, paid] = await Promise.all([
      q,
      ctx.supabase.from('be_enquiries').select('status'),
      ctx.supabase.from('be_bookings').select('id,reference,guest_name,check_in,check_out,status,total_paise,created_at').order('created_at', { ascending: false }).limit(50),
    ]);
    const tally = { new: 0, contacted: 0, confirmed: 0, lost: 0 } as Record<string, number>;
    for (const r of counts.data ?? []) tally[r.status] = (tally[r.status] ?? 0) + 1;
    return { ready: !enq.error, enquiries: enq.data ?? [], counts: tally, onlineBookings: paid.error ? [] : paid.data ?? [] };
  });

export const updateEnquiry = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: z.string().uuid(), status: STATUS.optional(), note: z.string().max(1000).optional() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status) patch.status = data.status;
    if (data.note !== undefined) patch.desk_note = data.note;
    const { error } = await ctx.supabase.from('be_enquiries').update(patch).eq('id', data.id);
    if (error) throw new Error('Could not update the enquiry');
    return { ok: true };
  });
