/** Super-admin server functions for room photos, Form C and invoices. */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSuperAdmin } from './adminAuth';

const uuid = z.string().uuid();
const roomId = z.string().max(60);

async function deps(context: unknown, withService = false) {
  const core = await import('./engineOps.core');
  let service = null;
  if (withService) {
    const { getServiceClient } = await import('./serviceClient.server');
    service = getServiceClient();
  }
  return { core, d: { db: (context as { supabase: unknown }).supabase, service, env: process.env, now: new Date() } };
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Something went wrong.');
  }
}

// Room photos
export const listRoomPhotosFn = createServerFn({ method: 'GET' }).middleware([requireSuperAdmin])
  .handler(async ({ context }) => { const { core, d } = await deps(context); return run(() => core.listPhotos(d)); });

export const addRoomPhotoFn = createServerFn({ method: 'POST' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({ roomTypeId: roomId, path: z.string().max(200), alt: z.string().max(160) }))
  .handler(async ({ data, context }) => { const { core, d } = await deps(context); return run(() => core.addPhoto(d, data)); });

export const updateRoomPhotoAltFn = createServerFn({ method: 'POST' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: uuid, alt: z.string().max(160) }))
  .handler(async ({ data, context }) => { const { core, d } = await deps(context); return run(() => core.updatePhotoAlt(d, data)); });

export const reorderRoomPhotosFn = createServerFn({ method: 'POST' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({ roomTypeId: roomId, ids: z.array(uuid).max(60) }))
  .handler(async ({ data, context }) => { const { core, d } = await deps(context); return run(() => core.reorderPhotos(d, data)); });

export const deleteRoomPhotoFn = createServerFn({ method: 'POST' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: uuid }))
  .handler(async ({ data, context }) => { const { core, d } = await deps(context); return run(() => core.deletePhoto(d, data)); });

// Form C
export const listFormCFn = createServerFn({ method: 'GET' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({ filter: z.enum(['due', 'submitted', 'all']) }))
  .handler(async ({ data, context }) => { const { core, d } = await deps(context); return run(() => core.listFormC(d, data.filter)); });

export const saveFormCFn = createServerFn({ method: 'POST' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({
    id: uuid, passportNumber: z.string().max(20), passportExpiry: z.string().max(10), visaNumber: z.string().max(30),
    visaType: z.string().max(40), formCNumber: z.string().max(40), submitted: z.boolean(),
  }))
  .handler(async ({ data, context }) => { const { core, d } = await deps(context); return run(() => core.saveFormC(d, data)); });

// Invoices
const invoicePropertyId = z.enum(['XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP']);
export const getBusinessFn = createServerFn({ method: 'GET' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({ propertyId: invoicePropertyId.optional() }).optional())
  .handler(async ({ data, context }) => { const { core, d } = await deps(context); return run(() => core.getBusiness(d, data?.propertyId)); });

export const saveBusinessFn = createServerFn({ method: 'POST' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({ propertyId: invoicePropertyId, gstRegistered: z.boolean(), legalName: z.string().max(160), gstin: z.string().max(15), address: z.string().max(400), stateCode: z.string().max(2), sacCode: z.string().max(6) }))
  .handler(async ({ data, context }) => { const { core, d } = await deps(context); return run(() => core.saveBusiness(d, data)); });

export const listInvoicesFn = createServerFn({ method: 'GET' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({ propertyId: invoicePropertyId.optional() }).optional())
  .handler(async ({ data, context }) => {
    const { core, d } = await deps(context);
    return run(async () => ({ invoices: await core.listInvoices(d, data?.propertyId), pending: await core.invoiceableBookings(d, data?.propertyId) }));
  });

export const issueTaxInvoiceFn = createServerFn({ method: 'POST' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({ bookingId: uuid, propertyId: invoicePropertyId.optional() }))
  .handler(async ({ data, context }) => { const { core, d } = await deps(context, true); return run(() => core.issueTaxInvoice(d, data.bookingId, data.propertyId)); });

export const getInvoiceDocFn = createServerFn({ method: 'GET' }).middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: uuid }))
  .handler(async ({ data, context }) => { const { core, d } = await deps(context); return run(() => core.getInvoiceDoc(d, data.id)); });
