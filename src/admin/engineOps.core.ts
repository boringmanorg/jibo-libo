/**
 * Console operations for the booking engine: room photos, Form C and invoices.
 * `db` is the super admin's own client (row-level security limits it to admin@xtsy.one);
 * `service` is the server-only client used just for invoice numbering, which RLS keeps from admins.
 */
import { BOOKING_ROOM_TYPES, findRoomType } from '@/booking/catalogue';
import { daysBetween, todayInIndia } from '@/booking/dates';
import { financialYear, invoiceNumber, type InvoiceKind } from '@/booking/invoiceNumber';
import { ROOM_PHOTO_BUCKET, roomPhotoUrl } from '@/booking/publicEngine.core';

type Db = any;
export interface OpsDeps { db: Db; service?: Db | null; env: Record<string, string | undefined>; now: Date }
export class OpsError extends Error {}

const PHOTO_EXT = /\.(jpe?g|png|webp|avif)$/i;
const knownRoom = (id: string) => BOOKING_ROOM_TYPES.some((r) => r.id === id);

// ---------------------------------------------------------------- room photos

export interface AdminPhoto { id: string; roomTypeId: string; path: string; alt: string; sort: number; url: string }

/** Where an upload for this room goes; the random part keeps names unguessable and unique. */
export function photoPath(roomTypeId: string, fileName: string, random: string): string {
  if (!knownRoom(roomTypeId)) throw new OpsError('Unknown room type.');
  const ext = (fileName.match(PHOTO_EXT)?.[1] ?? '').toLowerCase().replace('jpeg', 'jpg');
  if (!ext) throw new OpsError('Use a JPG, PNG, WebP or AVIF image.');
  if (!/^[a-z0-9-]{8,64}$/.test(random)) throw new OpsError('Bad file name.');
  return `${roomTypeId}/${random}.${ext}`;
}

export function validPhotoPath(roomTypeId: string, path: string): boolean {
  return knownRoom(roomTypeId) && new RegExp(`^${roomTypeId}/[a-z0-9-]{8,64}\\.(jpg|png|webp|avif)$`).test(path);
}

export async function listPhotos(d: OpsDeps): Promise<AdminPhoto[]> {
  const r = await d.db.from('be_room_photos').select('id,room_type_id,path,alt,sort').order('sort', { ascending: true });
  if (r.error) throw new OpsError('Could not load photos.');
  const base = d.env['SUPABASE_URL'] ?? '';
  return (r.data ?? []).map((p: any) => ({ id: p.id, roomTypeId: p.room_type_id, path: p.path, alt: p.alt ?? '', sort: p.sort, url: roomPhotoUrl(base, p.path) }));
}

export async function addPhoto(d: OpsDeps, input: { roomTypeId: string; path: string; alt: string }) {
  if (!validPhotoPath(input.roomTypeId, input.path)) throw new OpsError('That upload does not belong to this room.');
  const last = await d.db.from('be_room_photos').select('sort').eq('room_type_id', input.roomTypeId).order('sort', { ascending: false }).limit(1).maybeSingle();
  const sort = (last.data?.sort ?? -1) + 1;
  const ins = await d.db.from('be_room_photos').insert({ room_type_id: input.roomTypeId, path: input.path, alt: input.alt.trim().slice(0, 160), sort });
  if (ins.error) throw new OpsError('Could not save the photo.');
  return { ok: true };
}

export async function updatePhotoAlt(d: OpsDeps, input: { id: string; alt: string }) {
  const r = await d.db.from('be_room_photos').update({ alt: input.alt.trim().slice(0, 160) }).eq('id', input.id);
  if (r.error) throw new OpsError('Could not save the caption.');
  return { ok: true };
}

/** Saves a new order; every id must already belong to the room. */
export async function reorderPhotos(d: OpsDeps, input: { roomTypeId: string; ids: string[] }) {
  const r = await d.db.from('be_room_photos').select('id').eq('room_type_id', input.roomTypeId);
  const owned = new Set((r.data ?? []).map((x: any) => x.id));
  if (input.ids.length !== owned.size || input.ids.some((id) => !owned.has(id))) throw new OpsError('The photo list changed; reload and try again.');
  for (const [sort, id] of input.ids.entries()) {
    const u = await d.db.from('be_room_photos').update({ sort }).eq('id', id);
    if (u.error) throw new OpsError('Could not save the order.');
  }
  return { ok: true };
}

export async function deletePhoto(d: OpsDeps, input: { id: string }) {
  const r = await d.db.from('be_room_photos').select('path').eq('id', input.id).maybeSingle();
  if (!r.data) throw new OpsError('Photo not found.');
  const rm = await d.db.storage.from(ROOM_PHOTO_BUCKET).remove([r.data.path]);
  if (rm.error) throw new OpsError('Could not delete the file.');
  const del = await d.db.from('be_room_photos').delete().eq('id', input.id);
  if (del.error) throw new OpsError('Could not remove the photo.');
  return { ok: true };
}

// ---------------------------------------------------------------- Form C

export interface FormCRow {
  id: string; bookingId: string; reference: string; checkIn: string; checkOut: string; bookingStatus: string;
  fullName: string; nationality: string; passportNumber: string; passportExpiry: string; visaNumber: string; visaType: string;
  status: 'due' | 'submitted'; formCNumber: string; submittedAt: string | null;
  /** Hours left in the 24-hour window from check-in day; negative when overdue. */
  hoursLeft: number;
}

/** Form C is due within 24 hours of arrival; the clock starts at the check-in time (11 AM IST). */
export function formCHoursLeft(checkIn: string, now: Date): number {
  const arrival = new Date(`${checkIn}T11:00:00+05:30`).getTime();
  return Math.round((arrival + 24 * 3600_000 - now.getTime()) / 3600_000);
}

export async function listFormC(d: OpsDeps, filter: 'due' | 'submitted' | 'all'): Promise<FormCRow[]> {
  let q = d.db.from('be_guests')
    .select('id,booking_id,full_name,nationality,passport_number,passport_expiry,visa_number,visa_type,form_c_status,form_c_number,form_c_submitted_at,be_bookings!inner(reference,check_in,check_out,status)')
    .neq('form_c_status', 'not_required')
    .in('be_bookings.status', ['confirmed', 'checked_in', 'settled']);
  if (filter !== 'all') q = q.eq('form_c_status', filter);
  const r = await q;
  if (r.error) throw new OpsError('Could not load Form C records.');
  return (r.data ?? []).map((g: any) => ({
    id: g.id, bookingId: g.booking_id, reference: g.be_bookings.reference, checkIn: g.be_bookings.check_in, checkOut: g.be_bookings.check_out,
    bookingStatus: g.be_bookings.status, fullName: g.full_name, nationality: g.nationality ?? '',
    passportNumber: g.passport_number ?? '', passportExpiry: g.passport_expiry ?? '', visaNumber: g.visa_number ?? '', visaType: g.visa_type ?? '',
    status: g.form_c_status, formCNumber: g.form_c_number ?? '', submittedAt: g.form_c_submitted_at,
    hoursLeft: formCHoursLeft(g.be_bookings.check_in, d.now),
  })).sort((a: FormCRow, b: FormCRow) => a.checkIn.localeCompare(b.checkIn));
}

export interface FormCInput {
  id: string; passportNumber: string; passportExpiry: string; visaNumber: string; visaType: string;
  formCNumber: string; submitted: boolean;
}

export function formCProblems(i: FormCInput): string[] {
  const out: string[] = [];
  if (i.passportNumber && !/^[A-Z0-9]{5,20}$/i.test(i.passportNumber.trim())) out.push('Passport number should be 5–20 letters or digits.');
  if (i.passportExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(i.passportExpiry)) out.push('Passport expiry must be a date.');
  if (i.submitted) {
    if (!i.passportNumber.trim()) out.push('Add the passport number before marking Form C submitted.');
    if (!i.formCNumber.trim()) out.push('Add the Form C application number from the FRRO portal.');
  }
  return out;
}

export async function saveFormC(d: OpsDeps, i: FormCInput) {
  const problems = formCProblems(i);
  if (problems.length) throw new OpsError(problems.join(' '));
  const r = await d.db.from('be_guests').update({
    passport_number: i.passportNumber.trim().toUpperCase() || null,
    passport_expiry: i.passportExpiry || null,
    visa_number: i.visaNumber.trim().toUpperCase() || null,
    visa_type: i.visaType.trim() || null,
    form_c_number: i.formCNumber.trim() || null,
    form_c_status: i.submitted ? 'submitted' : 'due',
    form_c_submitted_at: i.submitted ? d.now.toISOString() : null,
  }).eq('id', i.id).neq('form_c_status', 'not_required');
  if (r.error) throw new OpsError('Could not save the Form C record.');
  return { ok: true };
}

// ---------------------------------------------------------------- invoices

export interface Business { legalName: string; gstin: string; address: string; stateCode: string; sacCode: string }

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function businessProblems(b: Business): string[] {
  const out: string[] = [];
  if (b.legalName.trim().length < 3) out.push('Enter the legal name printed on invoices.');
  if (b.gstin && !GSTIN.test(b.gstin.trim().toUpperCase())) out.push('GSTIN must be 15 characters, e.g. 17ABCDE1234F1Z5.');
  if (b.gstin && b.gstin.slice(0, 2) !== b.stateCode) out.push('The GSTIN’s first two digits should match the state code.');
  if (!/^\d{2}$/.test(b.stateCode)) out.push('State code is two digits (Meghalaya is 17).');
  if (!/^\d{6}$/.test(b.sacCode)) out.push('SAC code is six digits (996311 for accommodation).');
  if (b.address.trim().length < 10) out.push('Enter the full business address.');
  return out;
}

export async function getBusiness(d: OpsDeps): Promise<Business> {
  const r = await d.db.from('be_settings').select('legal_name,gstin,business_address,state_code,sac_code').eq('id', 1).maybeSingle();
  return {
    legalName: r.data?.legal_name ?? '', gstin: r.data?.gstin ?? '', address: r.data?.business_address ?? '',
    stateCode: r.data?.state_code ?? '17', sacCode: r.data?.sac_code ?? '996311',
  };
}

export async function saveBusiness(d: OpsDeps, b: Business) {
  const problems = businessProblems(b);
  if (problems.length) throw new OpsError(problems.join(' '));
  const r = await d.db.from('be_settings').update({
    legal_name: b.legalName.trim(), gstin: b.gstin.trim().toUpperCase(), business_address: b.address.trim(),
    state_code: b.stateCode, sac_code: b.sacCode, updated_at: d.now.toISOString(),
  }).eq('id', 1);
  if (r.error) throw new OpsError('Could not save business details.');
  return { ok: true };
}

export interface InvoiceRow { id: string; kind: InvoiceKind; number: string; taxable: number; gst: number; issuedAt: string; reference: string; guestName: string; checkIn: string }
export interface PendingInvoice { id: string; reference: string; guestName: string; checkIn: string; checkOut: string; status: string; total: number }

export async function listInvoices(d: OpsDeps): Promise<InvoiceRow[]> {
  const r = await d.db.from('be_invoices').select('id,kind,number,taxable_paise,gst_paise,issued_at,be_bookings(reference,guest_name,check_in)').order('issued_at', { ascending: false }).limit(300);
  if (r.error) throw new OpsError('Could not load invoices.');
  return (r.data ?? []).map((i: any) => ({
    id: i.id, kind: i.kind as InvoiceKind, number: i.number, taxable: Number(i.taxable_paise), gst: Number(i.gst_paise),
    issuedAt: i.issued_at, reference: i.be_bookings?.reference ?? '', guestName: i.be_bookings?.guest_name ?? '', checkIn: i.be_bookings?.check_in ?? '',
  }));
}

/** Bookings that have stayed (or are staying) and have no tax invoice yet. */
export async function invoiceableBookings(d: OpsDeps): Promise<PendingInvoice[]> {
  const b = await d.db.from('be_bookings').select('id,reference,guest_name,check_in,check_out,status,total_paise,be_invoices(kind)').in('status', ['checked_in', 'settled', 'confirmed']).lte('check_in', todayInIndia(d.now)).order('check_in', { ascending: false }).limit(200);
  if (b.error) throw new OpsError('Could not load bookings.');
  return (b.data ?? []).filter((x: any) => !(x.be_invoices ?? []).some((i: any) => i.kind === 'tax_invoice'))
    .map((x: any) => ({ id: x.id, reference: x.reference, guestName: x.guest_name, checkIn: x.check_in, checkOut: x.check_out, status: x.status, total: Number(x.total_paise) }));
}

export async function issueTaxInvoice(d: OpsDeps, bookingId: string) {
  if (!d.service) throw new OpsError('Invoice numbering is not available on this server.');
  const biz = await getBusiness(d);
  if (businessProblems(biz).length || !biz.gstin) throw new OpsError('Save the legal name, GSTIN and address under Business details first.');
  const b = await d.db.from('be_bookings').select('id,status,check_in,taxable_paise,gst_paise,be_invoices(kind)').eq('id', bookingId).maybeSingle();
  if (!b.data) throw new OpsError('Booking not found.');
  if (!['confirmed', 'checked_in', 'settled'].includes(b.data.status)) throw new OpsError('Only confirmed, checked-in or settled bookings get a tax invoice.');
  if ((b.data.be_invoices ?? []).some((i: any) => i.kind === 'tax_invoice')) throw new OpsError('This booking already has a tax invoice.');
  const fy = financialYear(todayInIndia(d.now));
  const seq = await d.service.rpc('be_next_invoice_seq', { p_fy: fy, p_kind: 'tax_invoice' });
  if (seq.error || typeof seq.data !== 'number') throw new OpsError('Could not get the next invoice number.');
  const number = invoiceNumber('tax_invoice', fy, seq.data);
  const ins = await d.db.from('be_invoices').insert({
    booking_id: bookingId, kind: 'tax_invoice', fy, seq: seq.data, number,
    taxable_paise: Number(b.data.taxable_paise), gst_paise: Number(b.data.gst_paise),
  }).select('id').single();
  if (ins.error) throw new OpsError(ins.error.code === '23505' ? 'This booking already has a tax invoice.' : 'Could not save the invoice.');
  return { ok: true, id: ins.data.id as string, number };
}

export interface InvoiceDoc {
  id: string; kind: InvoiceKind; number: string; issuedAt: string; business: Business;
  booking: { reference: string; guestName: string; guestEmail: string; guestPhone: string; checkIn: string; checkOut: string; nights: number };
  lines: { description: string; sac: string; taxable: number; gstBps: number; gst: number }[];
  taxable: number; gst: number; total: number;
  /** Hotel accommodation is taxed where the property is, so GST splits into CGST and SGST. */
  cgst: number; sgst: number;
  paid: number; balance: number;
}

export async function getInvoiceDoc(d: OpsDeps, id: string): Promise<InvoiceDoc> {
  const i = await d.db.from('be_invoices').select('id,kind,number,issued_at,taxable_paise,gst_paise,booking_id').eq('id', id).maybeSingle();
  if (!i.data) throw new OpsError('Invoice not found.');
  const b = await d.db.from('be_bookings').select('reference,guest_name,guest_email,guest_phone,check_in,check_out,taxable_paise,gst_paise,total_paise,be_booking_lines(room_type_id,units,guests,taxable_paise,gst_bps,gst_paise),be_payments(kind,status,amount_paise)').eq('id', i.data.booking_id).single();
  if (!b.data) throw new OpsError('Booking not found.');
  const business = await getBusiness(d);
  const nights = daysBetween(b.data.check_in, b.data.check_out);
  const taxable = Number(i.data.taxable_paise), gst = Number(i.data.gst_paise);
  let lines: InvoiceDoc['lines'];
  if (i.data.kind === 'advance_receipt') {
    lines = [{ description: `Advance towards accommodation, booking ${b.data.reference}`, sac: business.sacCode, taxable, gstBps: taxable > 0 ? Math.round((gst / taxable) * 10_000) : 0, gst }];
  } else {
    lines = (b.data.be_booking_lines ?? []).map((l: any) => ({
      description: `${findRoomType(l.room_type_id)?.name ?? l.room_type_id} × ${l.units}, ${nights} night${nights === 1 ? '' : 's'}`,
      sac: business.sacCode, taxable: Number(l.taxable_paise), gstBps: Number(l.gst_bps), gst: Number(l.gst_paise),
    }));
    const restTaxable = taxable - lines.reduce((s, l) => s + l.taxable, 0);
    const restGst = gst - lines.reduce((s, l) => s + l.gst, 0);
    if (restTaxable > 0) lines.push({ description: 'Breakfast, TAB Bistro', sac: '996331', taxable: restTaxable, gstBps: 500, gst: restGst });
  }
  const paid = (b.data.be_payments ?? []).filter((p: any) => p.status === 'succeeded' && p.kind !== 'refund').reduce((s: number, p: any) => s + Number(p.amount_paise), 0);
  const cgst = Math.floor(gst / 2);
  return {
    id: i.data.id, kind: i.data.kind, number: i.data.number, issuedAt: i.data.issued_at, business,
    booking: { reference: b.data.reference, guestName: b.data.guest_name, guestEmail: b.data.guest_email ?? '', guestPhone: b.data.guest_phone, checkIn: b.data.check_in, checkOut: b.data.check_out, nights },
    lines, taxable, gst, total: taxable + gst, cgst, sgst: gst - cgst,
    paid, balance: Math.max(0, Number(b.data.total_paise) - paid),
  };
}
