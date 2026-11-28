/** Sales: payments recorded against confirmed enquiries, and invoices issued from them. Property admins and super admin only. */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requirePropertyAdmin } from './adminAuth';
import { assertPropertyScope } from './consoleScope';
import { folioTotals, invoiceBlocker, propertyForKind, type FolioLine } from './sales';

type Ctx = { supabase: any; userId: string; isSuperAdmin: boolean };
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
  .handler(async ({ data, context }): Promise<{ payments: { id: string; amount: number; method: string; paidOn: string; note: string }[]; invoice: { id: string; number: string } | null }> => {
    const ctx = context as Ctx;
    const e = await enquiry(ctx, data.enquiryId);
    const [p, inv] = await Promise.all([
      ctx.supabase.from('be_sales_payments').select('id,amount_rupees,method,paid_on,note,created_at').eq('enquiry_id', e.id).order('paid_on'),
      ctx.supabase.from('be_sales_invoices').select('id,number').eq('enquiry_id', e.id).maybeSingle(),
    ]);
    return {
      payments: (p.data ?? []).map((x: any) => ({ id: x.id as string, amount: Number(x.amount_rupees), method: x.method as string, paidOn: x.paid_on as string, note: (x.note ?? '') as string })),
      invoice: inv.data ? { id: inv.data.id as string, number: inv.data.number as string } : null,
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
  .inputValidator(z.object({ enquiryId: uuid, lines: z.array(z.object({ description: z.string().max(200), amount: z.number().max(10_000_000) })).min(1).max(12) }))
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
    const lines: FolioLine[] = data.lines.map((l) => ({ description: l.description.trim(), amount: Math.round(l.amount * 100) / 100 }));
    const payments = (pays.data ?? []).map((p: any) => ({ amount: Number(p.amount_rupees), method: p.method, paidOn: p.paid_on, note: p.note ?? '' }));
    const blocker = invoiceBlocker({ status: e.status, kind: e.kind, payments: payments.length, gstRegistered: !!biz.data.gst_registered, hasInvoice: !!existing.data, lines });
    if (blocker) throw new Error(blocker);
    const { getServiceClient } = await import('./serviceClient.server');
    const { financialYear, invoiceNumber } = await import('@/booking/invoiceNumber');
    const fy = financialYear(todayIndia());
    const service = getServiceClient();
    if (!service) throw new Error('Invoice numbering is not available on this server.');
    const seq = await service.rpc('be_next_invoice_seq', { p_fy: fy, p_kind: 'business_invoice' });
    if (seq.error || typeof seq.data !== 'number') throw new Error('Could not get the next invoice number.');
    const number = invoiceNumber('business_invoice', fy, seq.data);
    const c = (ci.data ?? [])[0] ?? null;
    const folio = {
      reference: e.reference, guestName: c?.guest_name || e.guest_name, phone: c?.phone || e.guest_phone, email: c?.email ?? '',
      address: c ? [c.city, c.state, c.country].filter(Boolean).join(', ') : '', guests: c?.total_guests ?? e.guests, purpose: c?.purpose ?? '',
      checkIn: e.check_in, checkOut: e.check_out, arrival: c ? `${c.check_in_date} ${String(c.check_in_time ?? '').slice(0, 5)}` : '',
      departure: c?.check_out_date ? `${c.check_out_date} ${String(c.check_out_time ?? '').slice(0, 5)}` : '', rooms: (c?.allocated_units ?? []) as string[],
      lines, payments, ...folioTotals(lines, payments),
    };
    const business = { legalName: biz.data.legal_name, gstRegistered: false, gstin: biz.data.gstin ?? '', address: biz.data.business_address ?? '', stateCode: biz.data.state_code ?? '17', sacCode: biz.data.sac_code ?? '996311' };
    const ins = await ctx.supabase.from('be_sales_invoices').insert({ enquiry_id: e.id, property_id: e.propertyId, kind: 'business_invoice', fy, seq: seq.data, number, folio, business_snapshot: business, total_rupees: folio.total, issued_by: ctx.userId }).select('id').single();
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
    return (rows ?? []).map((r: any) => ({ id: r.id as string, number: r.number as string, total: Number(r.total_rupees), issuedAt: r.issued_at as string, propertyId: r.property_id as string, guestName: String(r.folio?.guestName ?? ''), reference: String(r.folio?.reference ?? ''), balance: Number(r.folio?.balance ?? 0) }));
  });

export const getSalesInvoice = createServerFn({ method: 'GET' })
  .middleware([requirePropertyAdmin])
  .inputValidator(z.object({ id: uuid }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: r } = await ctx.supabase.from('be_sales_invoices').select('id,number,kind,issued_at,property_id,folio,business_snapshot,total_rupees').eq('id', data.id).maybeSingle();
    if (!r) throw new Error('Invoice not found.');
    assertPropertyScope(ctx.isSuperAdmin, r.property_id);
    return { id: r.id as string, number: r.number as string, issuedAt: r.issued_at as string, propertyId: r.property_id as string, folio: r.folio as any, business: r.business_snapshot as any };
  });
