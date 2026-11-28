/** Sales: payments recorded against confirmed enquiries, and invoices issued from them. Property admins and super admin only. */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requirePropertyAdmin } from './adminAuth';
import { assertPropertyScope, canManageProperty } from './consoleScope';
import { type SalesPayment, folioTotals, gstBreakdown, invoiceBlocker, paymentProblem, propertyForKind, type FolioLine } from './sales';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
type Ctx = { supabase: SupabaseClient<Database>; userId: string; isSuperAdmin: boolean };
const uuid = z.string().uuid();
const todayIndia = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

async function enquiry(ctx: Ctx, id: string) {
  const { data } = await ctx.supabase.from('be_enquiries').select('id,reference,kind,guest_name,guest_phone,check_in,check_out,guests,summary,estimate_rupees,status').eq('id', id).maybeSingle();
  if (!data) throw new Error('Enquiry not found.');
  const propertyId = propertyForKind(data.kind);
  assertPropertyScope(ctx.isSuperAdmin, propertyId);
  return { ...data, propertyId };
}

export const getSalesFolio = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ enquiryId: uuid }))
  .handler(async ({ data, context }): Promise<{ payments: { id: string; amount: number; method: string; paidOn: string; note: string }[]; invoice: { id: string; number: string; total: number } | null; gstRegistered: boolean }> => {
    const ctx = context as Ctx;
    const e = await enquiry(ctx, data.enquiryId);
    const [p, inv, biz] = await Promise.all([
      ctx.supabase.from('be_sales_payments').select('id,amount_rupees,method,paid_on,note,created_at').eq('enquiry_id', e.id).order('paid_on'),
      ctx.supabase.from('be_sales_invoices').select('id,number,total_rupees').eq('enquiry_id', e.id).maybeSingle(),
      ctx.supabase.from('be_property_invoice_profiles').select('gst_registered').eq('property_id', e.propertyId).maybeSingle(),
    ]);
    return {
      payments: (p.data ?? []).map((x) => ({ id: x.id as string, amount: Number(x.amount_rupees), method: x.method as string, paidOn: x.paid_on as string, note: (x.note ?? '') as string })),
      invoice: inv.data ? { id: inv.data.id as string, number: inv.data.number as string, total: Number(inv.data.total_rupees) } : null,
      gstRegistered: !!biz.data?.gst_registered,
    };
  });

export const recordSalesPayment = createServerFn({ method: 'POST' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ enquiryId: uuid, amount: z.number().positive().max(10_000_000), method: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'other']), paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().max(300).optional() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const e = await enquiry(ctx, data.enquiryId);
    if (e.status !== 'confirmed') throw new Error('Mark the enquiry confirmed before recording a payment.');
    if (data.paidOn > todayIndia()) throw new Error('The payment date cannot be in the future.');
    const [inv, prior] = await Promise.all([
      ctx.supabase.from('be_sales_invoices').select('total_rupees').eq('enquiry_id', e.id).maybeSingle(),
      ctx.supabase.from('be_sales_payments').select('amount_rupees').eq('enquiry_id', e.id),
    ]);
    const paid = ((prior.data ?? []) as { amount_rupees: number }[]).reduce((a, p) => a + Number(p.amount_rupees), 0);
    const problem = paymentProblem(data.amount, inv.data ? Number(inv.data.total_rupees) : null, paid);
    if (problem) throw new Error(problem);
    const { error } = await ctx.supabase.from('be_sales_payments').insert({ enquiry_id: e.id, property_id: e.propertyId, amount_rupees: Math.round(data.amount * 100) / 100, method: data.method, paid_on: data.paidOn, note: data.note?.trim() || null, recorded_by: ctx.userId });
    if (error) throw new Error('Could not save the payment.');
    return { ok: true };
  });

export const deleteSalesPayment = createServerFn({ method: 'POST' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ id: uuid, enquiryId: uuid }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const e = await enquiry(ctx, data.enquiryId);
    const inv = await ctx.supabase.from('be_sales_invoices').select('id').eq('enquiry_id', e.id).maybeSingle();
    if (inv.data) throw new Error('This booking is already invoiced; payments can no longer be removed.');
    const { error } = await ctx.supabase.from('be_sales_payments').delete().eq('id', data.id).eq('enquiry_id', e.id);
    if (error) throw new Error('Could not remove the payment.');
    return { ok: true };
  });

export const issueSalesInvoice = createServerFn({ method: 'POST' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ enquiryId: uuid, lines: z.array(z.object({ description: z.string().max(200), amount: z.number().max(10_000_000), gstRate: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18)]).optional() })).min(1).max(12) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const e = await enquiry(ctx, data.enquiryId);
    const [biz, pays, existing, ci] = await Promise.all([
      ctx.supabase.from('be_property_invoice_profiles').select('legal_name,gst_registered,gstin,business_address,state_code,sac_code').eq('property_id', e.propertyId).maybeSingle(),
      ctx.supabase.from('be_sales_payments').select('amount_rupees,method,paid_on,note').eq('enquiry_id', e.id).order('paid_on'),
      ctx.supabase.from('be_sales_invoices').select('id').eq('enquiry_id', e.id).maybeSingle(),
      ctx.supabase.from('be_self_check_ins').select('guest_name,phone,email,city,state,country,total_guests,purpose,check_in_date,check_in_time,check_out_date,check_out_time,allocated_units').eq('booking_reference', e.reference).order('created_at', { ascending: false }).limit(1),
    ]);
    if (!biz.data || String(biz.data.legal_name ?? '').trim().length < 3) throw new Error('Save this property’s legal name and address first.');
    const registered = !!biz.data.gst_registered;
    if (registered && !/^[0-9]{2}[A-Z0-9]{13}$/.test(String(biz.data.gstin ?? '').trim().toUpperCase())) throw new Error('Save this property’s GSTIN first.');
    const lines: FolioLine[] = data.lines.map((l) => ({ description: l.description.trim(), amount: Math.round(l.amount * 100) / 100, ...(registered ? { gstRate: l.gstRate } : {}) }));
    const payments = (pays.data ?? []).map((p) => ({ amount: Number(p.amount_rupees), method: p.method as SalesPayment['method'], paidOn: p.paid_on, note: p.note ?? '' }));
    const blocker = invoiceBlocker({ status: e.status, kind: e.kind, payments: payments.length, gstRegistered: !!biz.data.gst_registered, hasInvoice: !!existing.data, lines });
    if (blocker) throw new Error(blocker);
    const { getServiceClient } = await import('./serviceClient.server');
    const { financialYear, invoiceNumber } = await import('@/booking/invoiceNumber');
    const fy = financialYear(todayIndia());
    const kind = registered ? 'tax_invoice' as const : 'business_invoice' as const;
    const service = getServiceClient();
    if (!service) throw new Error('Invoice numbering is not available on this server.');
    const seq = await service.rpc('be_next_invoice_seq', { p_fy: fy, p_kind: kind });
    if (seq.error || typeof seq.data !== 'number') throw new Error('Could not get the next invoice number.');
    const number = invoiceNumber(kind, fy, seq.data);
    const c = (ci.data ?? [])[0] ?? null;
    const folio = {
      reference: e.reference, guestName: c?.guest_name || e.guest_name, phone: c?.phone || e.guest_phone, email: c?.email ?? '',
      address: c ? [c.city, c.state, c.country].filter(Boolean).join(', ') : '', guests: c?.total_guests ?? e.guests, purpose: c?.purpose ?? '',
      checkIn: e.check_in, checkOut: e.check_out, arrival: c ? `${c.check_in_date} ${String(c.check_in_time ?? '').slice(0, 5)}` : '',
      departure: c?.check_out_date ? `${c.check_out_date} ${String(c.check_out_time ?? '').slice(0, 5)}` : '', rooms: (c?.allocated_units ?? []) as string[],
      lines, payments, ...folioTotals(lines, payments), ...(registered ? { gst: gstBreakdown(lines) } : {}),
    };
    const business = { legalName: biz.data.legal_name, gstRegistered: registered, gstin: registered ? String(biz.data.gstin).trim().toUpperCase() : '', address: biz.data.business_address ?? '', stateCode: biz.data.state_code ?? '17', sacCode: biz.data.sac_code ?? '996311' };
    const ins = await ctx.supabase.from('be_sales_invoices').insert({ enquiry_id: e.id, property_id: e.propertyId, kind, fy, seq: seq.data, number, folio: folio as unknown as Json, business_snapshot: business as unknown as Json, total_rupees: folio.total, issued_by: ctx.userId }).select('id').single();
    if (ins.error) throw new Error(ins.error.code === '23505' ? 'This booking already has an invoice.' : 'Could not save the invoice.');
    return { id: ins.data.id as string, number };
  });

export const listSalesInvoices = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ propertyId: z.enum(['XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP']).optional() }))
  .handler(async ({ data, context }): Promise<{ id: string; number: string; total: number; issuedAt: string; propertyId: string; guestName: string; reference: string; balance: number }[]> => {
    const ctx = context as Ctx;
    let q = ctx.supabase.from('be_sales_invoices').select('id,number,total_rupees,issued_at,property_id,folio').order('issued_at', { ascending: false }).limit(200);
    if (data.propertyId) q = q.eq('property_id', data.propertyId);
    const { data: rows, error } = await q;
    if (error) throw new Error('Could not load invoices.');
    return (rows ?? []).filter((r) => canManageProperty(ctx.isSuperAdmin, r.property_id)).map((r) => { const f = (r.folio ?? {}) as { guestName?: string; reference?: string; balance?: number }; return { id: r.id as string, number: r.number as string, total: Number(r.total_rupees), issuedAt: r.issued_at as string, propertyId: r.property_id as string, guestName: String(f.guestName ?? ''), reference: String(f.reference ?? ''), balance: Number(f.balance ?? 0) }; });
  });

export const getSalesInvoice = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ id: uuid }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: r } = await ctx.supabase.from('be_sales_invoices').select('id,number,kind,issued_at,property_id,enquiry_id,folio,business_snapshot,total_rupees').eq('id', data.id).maybeSingle();
    if (!r) throw new Error('Invoice not found.');
    assertPropertyScope(ctx.isSuperAdmin, r.property_id);
    // Payments are read live so balance payments recorded after issue show on every print.
    const { data: pays } = await ctx.supabase.from('be_sales_payments').select('amount_rupees,method,paid_on,note').eq('enquiry_id', r.enquiry_id).order('paid_on');
    const payments = ((pays ?? []) as { amount_rupees: number; method: string; paid_on: string; note: string | null }[]).map((p) => ({ amount: Number(p.amount_rupees), method: p.method, paidOn: p.paid_on, note: p.note ?? '' }));
    const total = Number(r.total_rupees);
    const paid = Math.round(payments.reduce((a, p) => a + p.amount, 0) * 100) / 100;
    return { id: r.id as string, number: r.number as string, kind: r.kind as string, issuedAt: r.issued_at as string, propertyId: r.property_id as string, folio: { ...(r.folio as unknown as InvoiceDoc), payments, total, paid, balance: Math.round((total - paid) * 100) / 100 }, business: r.business_snapshot as unknown as InvoiceBusiness };
  });

/** Guest Folio list: every guest with a WhatsApp enquiry, grouped by number, limited to the properties this login manages. */
export const listGuestFolios = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ propertyId: z.enum(['XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP']).optional(), q: z.string().max(60).optional() }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { stays, names } = await loadStays(ctx, data.propertyId);
    const { summarizeGuest } = await import('./guestFolio');
    const groups = new Map<string, FolioStay[]>();
    for (const s of stays) { const k = names.get(s.enquiryId)!.key; groups.set(k, [...(groups.get(k) ?? []), s]); }
    const term = (data.q ?? '').trim().toLowerCase();
    return [...groups.entries()].map(([key, list]) => {
      const n = names.get(list[0]!.enquiryId)!;
      return summarizeGuest(key, n.name, n.phone, list);
    }).filter((g) => !term || g.name.toLowerCase().includes(term) || g.phone.replace(/\D/g, '').includes(term.replace(/\D/g, '') || '\u0000'))
      .sort((a, b) => b.lastStay.localeCompare(a.lastStay));
  });

export const getGuestFolio = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ key: z.string().regex(/^\d{10}$/) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { stays, names } = await loadStays(ctx, undefined, data.key);
    if (!stays.length) throw new Error('Guest not found.');
    const ids = stays.map((s) => s.enquiryId);
    const { data: pays } = await ctx.supabase.from('be_sales_payments').select('id,enquiry_id,amount_rupees,method,paid_on,note').in('enquiry_id', ids).order('paid_on');
    const { summarizeGuest } = await import('./guestFolio');
    const n = names.get(stays[0]!.enquiryId)!;
    return {
      summary: summarizeGuest(data.key, n.name, n.phone, stays),
      stays: stays.sort((a, b) => b.checkIn.localeCompare(a.checkIn)),
      payments: ((pays ?? []) as { id: string; enquiry_id: string; amount_rupees: number; method: string; paid_on: string; note: string | null }[]).map((p) => ({ id: p.id, enquiryId: p.enquiry_id, amount: Number(p.amount_rupees), method: p.method, paidOn: p.paid_on, note: p.note ?? '' })),
    };
  });

type FolioStay = import('./guestFolio').FolioStay;
async function loadStays(ctx: Ctx, propertyId?: 'XTSY-SHL-HOSTEL' | 'XTSY-SHN-CAMP', key?: string) {
  const { guestKey } = await import('./guestFolio');
  const kinds = propertyId ? [propertyId === 'XTSY-SHN-CAMP' ? 'camp' : 'stay'] : ctx.isSuperAdmin ? ['stay', 'camp'] : ['stay'];
  let q = ctx.supabase.from('be_enquiries').select('id,reference,kind,guest_name,guest_phone,check_in,check_out,guests,status,estimate_rupees').in('kind', kinds).order('check_in', { ascending: false }).limit(2000);
  if (key) q = q.ilike('guest_phone', `%${key.slice(-4)}%`);
  const { data: rows, error } = await q;
  if (error) throw new Error('Could not load guests.');
  type E = { id: string; reference: string; kind: string; guest_name: string; guest_phone: string; check_in: string; check_out: string; guests: number; status: string; estimate_rupees: number };
  const list = ((rows ?? []) as E[]).filter((e) => canManageProperty(ctx.isSuperAdmin, propertyForKind(e.kind)) && (!key || guestKey(e.guest_phone) === key));
  const ids = list.map((e) => e.id);
  const [inv, pay] = ids.length ? await Promise.all([
    ctx.supabase.from('be_sales_invoices').select('id,number,total_rupees,enquiry_id').in('enquiry_id', ids),
    ctx.supabase.from('be_sales_payments').select('enquiry_id,amount_rupees').in('enquiry_id', ids),
  ]) : [{ data: [] }, { data: [] }];
  const invBy = new Map(((inv.data ?? []) as { id: string; number: string; total_rupees: number; enquiry_id: string }[]).map((i) => [i.enquiry_id, { id: i.id, number: i.number, total: Number(i.total_rupees) }]));
  const paidBy = new Map<string, number>();
  for (const p of (pay.data ?? []) as { enquiry_id: string; amount_rupees: number }[]) paidBy.set(p.enquiry_id, (paidBy.get(p.enquiry_id) ?? 0) + Number(p.amount_rupees));
  const names = new Map(list.map((e) => [e.id, { key: guestKey(e.guest_phone), name: e.guest_name, phone: e.guest_phone }]));
  const stays: FolioStay[] = list.filter((e) => guestKey(e.guest_phone).length === 10).map((e) => ({
    enquiryId: e.id, reference: e.reference, propertyId: propertyForKind(e.kind), checkIn: e.check_in, checkOut: e.check_out, guests: e.guests,
    status: e.status, estimate: Number(e.estimate_rupees), invoice: invBy.get(e.id) ?? null, paid: Math.round((paidBy.get(e.id) ?? 0) * 100) / 100,
  }));
  return { stays, names };
}

type InvoiceBusiness = { legalName: string; gstRegistered: boolean; gstin: string; address: string; stateCode: string; sacCode: string };
type InvoiceDoc = { reference: string; guestName: string; phone: string; email: string; address: string; guests: number; purpose: string; checkIn: string; checkOut: string; arrival: string; departure: string; rooms: string[]; lines: FolioLine[]; gst?: ReturnType<typeof gstBreakdown> };
