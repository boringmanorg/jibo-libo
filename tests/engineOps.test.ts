import { describe, expect, it } from 'vitest';
import {
  addPhoto, businessProblems, deletePhoto, formCHoursLeft, formCProblems, getInvoiceDoc, issueTaxInvoice,
  listInvoices, listPhotos, photoPath, reorderPhotos, saveFormC, validPhotoPath, type OpsDeps,
} from '../src/admin/engineOps.core';
import { verifyBotCheck, botCheckSiteKey } from '../src/booking/botCheck';
import { generateProductionSecurityHeaders, withBotCheckSources, isBookingPath } from '../src/utils/productionSecurityHeaders';

type Row = Record<string, any>;
function fakeDb(t: Record<string, Row[]>) {
  let n = 0;
  const removed: string[] = [];
  const from = (table: string) => {
    const f: ((r: Row) => boolean)[] = [];
    let op = 'select', payload: any, single: string | null = null, order: [string, boolean] | null = null, lim = Infinity, cols = '*';
    const api: any = {
      select(c = '*') { cols = c; return api; }, insert(p: any) { op = 'insert'; payload = p; return api; }, update(p: any) { op = 'update'; payload = p; return api; },
      delete() { op = 'delete'; return api; }, eq(k: string, v: any) { f.push((r) => r[k] === v); return api; }, neq(k: string, v: any) { f.push((r) => r[k] !== v); return api; },
      in(k: string, v: any[]) { f.push((r) => v.includes(r[k])); return api; }, lte() { return api; },
      or(expression: string) { if (expression === 'property_id.eq.XTSY-SHL-HOSTEL,property_id.is.null') f.push((r) => r.property_id === 'XTSY-SHL-HOSTEL' || r.property_id == null); return api; },
      order(k: string, o?: { ascending?: boolean }) { order = [k, o?.ascending !== false]; return api; }, limit(x: number) { lim = x; return api; },
      single() { single = 'one'; return api; }, maybeSingle() { single = 'maybe'; return api; },
      then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); },
    };
    const run = () => {
      const rows = (t[table] ??= []);
      if (op === 'insert') {
        const list = (Array.isArray(payload) ? payload : [payload]).map((p) => ({ id: `00000000-0000-4000-8000-00000000000${++n}`, issued_at: '2026-11-20T06:00:00Z', ...p }));
        if (table === 'be_invoices' && list.some((p) => rows.some((r) => r.booking_id === p.booking_id && r.kind === p.kind))) return { data: null, error: { code: '23505' } };
        rows.push(...list);
        return { data: single ? list[0] : list, error: null };
      }
      let hit = rows.filter((r) => f.every((g) => g(r)));
      if (op === 'update') { hit.forEach((r) => Object.assign(r, payload)); return { data: hit, error: null }; }
      if (op === 'delete') { t[table] = rows.filter((r) => !hit.includes(r)); return { data: hit, error: null }; }
      if (order) { const [k, asc] = order; hit = [...hit].sort((a, b) => (a[k] > b[k] ? 1 : -1) * (asc ? 1 : -1)); }
      hit = hit.slice(0, lim).map((r) => {
        const o = { ...r };
        if (cols.includes('be_booking_lines(')) o.be_booking_lines = (t.be_booking_lines ?? []).filter((l) => l.booking_id === r.id);
        if (cols.includes('be_payments(')) o.be_payments = (t.be_payments ?? []).filter((l) => l.booking_id === r.id);
        if (cols.includes('be_invoices(')) o.be_invoices = (t.be_invoices ?? []).filter((l) => l.booking_id === r.id);
        return o;
      });
      if (single) return { data: hit[0] ?? null, error: null };
      return { data: hit, error: null };
    };
    return api;
  };
  return { t, removed, from, storage: { from: () => ({ remove: async (p: string[]) => { removed.push(...p); return { error: null }; } }) } };
}

const NOW = new Date('2026-11-20T06:00:00Z');
const ROOM = 'king-room-with-mountain-view';
const ops = (t: Record<string, Row[]>, extra: Partial<OpsDeps> = {}) => {
  const db = fakeDb(t);
  return { db, d: { db, env: { SUPABASE_URL: 'https://p.supabase.co' }, now: NOW, ...extra } as OpsDeps };
};

describe('room photos', () => {
  it('builds upload paths only for real rooms and image types', () => {
    expect(photoPath(ROOM, 'a.JPEG', 'abcdef1234')).toBe(`${ROOM}/abcdef1234.jpg`);
    expect(() => photoPath('nope', 'a.jpg', 'abcdef1234')).toThrow(/Unknown/);
    expect(() => photoPath(ROOM, 'a.gif', 'abcdef1234')).toThrow(/JPG/);
    expect(validPhotoPath(ROOM, `${ROOM}/abcdef1234.webp`)).toBe(true);
    expect(validPhotoPath(ROOM, `experience-by-xtsy/abcdef1234.webp`)).toBe(false);
    expect(validPhotoPath(ROOM, `${ROOM}/../x.jpg`)).toBe(false);
  });

  it('adds in order, reorders, and deletes the file with the row', async () => {
    const { db, d } = ops({ be_room_photos: [] });
    await addPhoto(d, { roomTypeId: ROOM, path: `${ROOM}/aaaaaaaa11.jpg`, alt: 'Bed' });
    await addPhoto(d, { roomTypeId: ROOM, path: `${ROOM}/bbbbbbbb22.jpg`, alt: 'View' });
    let list = await listPhotos(d);
    expect(list.map((p) => p.alt)).toEqual(['Bed', 'View']);
    expect(list[0].url).toBe(`https://p.supabase.co/storage/v1/object/public/room-photos/${ROOM}/aaaaaaaa11.jpg`);
    await reorderPhotos(d, { roomTypeId: ROOM, ids: [list[1].id, list[0].id] });
    list = await listPhotos(d);
    expect(list.map((p) => p.alt)).toEqual(['View', 'Bed']);
    await expect(reorderPhotos(d, { roomTypeId: ROOM, ids: [list[0].id] })).rejects.toThrow(/reload/);
    await deletePhoto(d, { id: list[0].id });
    expect(db.removed).toEqual([`${ROOM}/bbbbbbbb22.jpg`]);
    expect((await listPhotos(d)).map((p) => p.alt)).toEqual(['Bed']);
  });

  it('refuses a path that points at another room', async () => {
    const { d } = ops({});
    await expect(addPhoto(d, { roomTypeId: ROOM, path: 'experience-by-xtsy/aaaaaaaa11.jpg', alt: '' })).rejects.toThrow(/does not belong/);
  });
});

describe('Form C', () => {
  it('counts 24 hours from the 11 AM check-in', () => {
    expect(formCHoursLeft('2026-11-20', NOW)).toBe(24);
    expect(formCHoursLeft('2026-11-18', NOW)).toBe(-24);
  });
  it('needs a passport number and application number to mark submitted', () => {
    const base = { id: 'g', passportNumber: '', passportExpiry: '', visaNumber: '', visaType: '', formCNumber: '', submitted: true };
    expect(formCProblems(base)).toHaveLength(2);
    expect(formCProblems({ ...base, passportNumber: 'X1234567', formCNumber: 'FC-1' })).toEqual([]);
  });
  it('saves and marks submitted', async () => {
    const t = { be_guests: [{ id: 'g1', form_c_status: 'due' }] };
    const { d } = ops(t);
    await saveFormC(d, { id: 'g1', passportNumber: 'x1234567', passportExpiry: '2030-01-01', visaNumber: 'v1', visaType: 'e-Tourist', formCNumber: 'FC-9', submitted: true });
    expect(t.be_guests[0]).toMatchObject({ passport_number: 'X1234567', form_c_status: 'submitted', form_c_number: 'FC-9' });
  });
});

describe('invoices', () => {
  const biz = { legal_name: 'XTSY Ventures Private Limited', gstin: '17ABCDE1234F1Z5', business_address: 'Mawdiangdiang Road, New Shillong Township, Meghalaya', state_code: '17', sac_code: '996311' };
  const seed = () => ({
    be_settings: [{ id: 1, ...biz }],
    be_bookings: [{ id: 'b1', reference: 'XTSY-ABCDEF', status: 'checked_in', check_in: '2026-11-18', check_out: '2026-11-20', guest_name: 'Asha', guest_email: 'a@x.in', guest_phone: '+91', taxable_paise: 536000, gst_paise: 26800, total_paise: 562800 }],
    be_booking_lines: [{ booking_id: 'b1', room_type_id: ROOM, units: 1, guests: 2, taxable_paise: 480000, gst_bps: 500, gst_paise: 24000 }],
    be_payments: [{ booking_id: 'b1', kind: 'advance', status: 'succeeded', amount_paise: 140700 }],
    be_invoices: [] as Row[],
  });

  it('validates business details', () => {
    expect(businessProblems({ propertyId: 'XTSY-SHL-HOSTEL', gstRegistered: true, legalName: 'XTSY Ventures Private Limited', gstin: '17ABCDE1234F1Z5', address: 'New Shillong Township, Meghalaya', stateCode: '17', sacCode: '996311' })).toEqual([]);
    expect(businessProblems({ propertyId: 'XTSY-SHL-HOSTEL', gstRegistered: true, legalName: 'X', gstin: '18ABCDE1234F1Z5', address: 'x', stateCode: '17', sacCode: '99' }).length).toBeGreaterThanOrEqual(4);
    expect(businessProblems({ propertyId: 'XTSY-SHN-CAMP', gstRegistered: false, legalName: 'Shnonpedeng Riverside Camping by XTSY', gstin: '', address: 'Shnonpedeng, Meghalaya', stateCode: '17', sacCode: '996311' })).toEqual([]);
  });

  it('issues one numbered tax invoice per booking, with breakfast as its own line and CGST/SGST halves', async () => {
    const t = seed();
    const service = { rpc: async () => ({ data: 7, error: null }) };
    const { d } = ops(t, { service });
    const r = await issueTaxInvoice(d, 'b1');
    expect(r.number).toBe('XTSY/2026-27/TI/0007');
    await expect(issueTaxInvoice(d, 'b1')).rejects.toThrow(/already/);
    const doc = await getInvoiceDoc(d, r.id);
    expect(doc.lines.map((l) => l.description)).toEqual(['King Room with Mountain View × 1, 2 nights', 'Breakfast, TAB Bistro']);
    expect(doc.lines[1]).toMatchObject({ taxable: 56000, gst: 2800, sac: '996331' });
    expect(doc.cgst + doc.sgst).toBe(26800);
    expect(doc).toMatchObject({ taxable: 536000, total: 562800, paid: 140700, balance: 422100 });
  });

  it('issues a business invoice without GST when the property is not GST registered', async () => {
    const t = seed(); t.be_settings[0].gstin = '';
    const { d } = ops(t, { service: { rpc: async () => ({ data: 3, error: null }) } });
    const r = await issueTaxInvoice(d, 'b1');
    expect(r.number).toBe('XTSY/2026-27/BI/0003');
    const doc = await getInvoiceDoc(d, r.id);
    expect(doc.business.gstRegistered).toBe(false);
    expect(doc).toMatchObject({ taxable: 562800, gst: 0, total: 562800, cgst: 0, sgst: 0 });
    expect(doc.lines).toHaveLength(1);
    expect(doc.lines[0]).toMatchObject({ gstBps: 0, gst: 0 });
  });

  it('requires a GSTIN only in registered mode and requires invoice numbering', async () => {
    const t = seed(); t.be_settings[0].gstin = '';
    t.be_property_invoice_profiles = [{ property_id: 'XTSY-SHL-HOSTEL', legal_name: 'XTSY Ventures Private Limited', gst_registered: true, gstin: '', business_address: 'New Shillong Township, Meghalaya', state_code: '17', sac_code: '996311' }];
    await expect(issueTaxInvoice(ops(t, { service: { rpc: async () => ({ data: 1, error: null }) } }).d, 'b1')).rejects.toThrow(/tax status|GSTIN/);
    await expect(issueTaxInvoice(ops(seed()).d, 'b1')).rejects.toThrow(/numbering/);
  });

  it('keeps each property invoice list separate and includes legacy hostel invoices', async () => {
    const t = seed();
    t.be_invoices = [
      { id: 'i1', property_id: null, number: 'XTSY/2026-27/TI/0001', kind: 'tax_invoice', taxable_paise: 1, gst_paise: 0, issued_at: '2026-11-20T06:00:00Z' },
      { id: 'i2', property_id: 'XTSY-SHL-HOSTEL', number: 'XTSY/2026-27/BI/0002', kind: 'business_invoice', taxable_paise: 2, gst_paise: 0, issued_at: '2026-11-21T06:00:00Z' },
      { id: 'i3', property_id: 'XTSY-SHN-CAMP', number: 'XTSY/2026-27/BI/0003', kind: 'business_invoice', taxable_paise: 3, gst_paise: 0, issued_at: '2026-11-22T06:00:00Z' },
    ];
    const { d } = ops(t);
    expect((await listInvoices(d)).map((i) => i.number)).toEqual(['XTSY/2026-27/BI/0002', 'XTSY/2026-27/TI/0001']);
    expect((await listInvoices(d, 'XTSY-SHN-CAMP')).map((i) => i.number)).toEqual(['XTSY/2026-27/BI/0003']);
  });

  it('does not file a hostel booking under the campsite profile', async () => {
    const { d } = ops(seed(), { service: { rpc: async () => ({ data: 1, error: null }) } });
    await expect(issueTaxInvoice(d, 'b1', 'XTSY-SHN-CAMP')).rejects.toThrow(/not connected/);
  });
});

describe('bot check', () => {
  const env = { TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'test-value' };
  it('passes only when Cloudflare says success', async () => {
    const yes = async () => new Response('{"success":true}');
    const no = async () => new Response('{"success":false}');
    expect(await verifyBotCheck(env, 'tok', '1.2.3.4', yes)).toBe(true);
    expect(await verifyBotCheck(env, 'tok', undefined, no)).toBe(false);
    expect(await verifyBotCheck(env, undefined, undefined, yes)).toBe(false);
    expect(await verifyBotCheck({}, 'tok', undefined, yes)).toBe(false);
    expect(await verifyBotCheck(env, 'tok', undefined, async () => { throw new Error('down'); })).toBe(false);
  });
  it('shares only the site key with the browser', () => {
    expect(botCheckSiteKey(env)).toBe('site');
    expect(botCheckSiteKey({ TURNSTILE_SITE_KEY: 'site' })).toBeNull();
  });
  it('booking pages allow the Turnstile script and frame; guest pages do not', () => {
    const csp = generateProductionSecurityHeaders({ isDevelopment: false })['Content-Security-Policy'];
    expect(csp).not.toMatch(/challenges\.cloudflare\.com/);
    const b = withBotCheckSources(csp);
    for (const dir of ['script-src', 'frame-src', 'connect-src']) expect(b).toMatch(new RegExp(`${dir} [^;]*https://challenges\\.cloudflare\\.com`));
    expect(withBotCheckSources(b)).toBe(b);
    expect(isBookingPath('/book')).toBe(true);
    expect(isBookingPath('/book/confirmation')).toBe(true);
    expect(isBookingPath('/bookings-guide')).toBe(false);
  });
});
