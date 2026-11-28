import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { z } from 'zod';
import { requireCheckInStaff } from '@/admin/adminAuth';

async function serviceDeps() {
  const { getServiceClient } = await import('@/admin/serviceClient.server');
  return getServiceClient();
}

function requestIp(): string | undefined {
  const req = getRequest();
  return req?.headers.get('cf-connecting-ip') ?? req?.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? undefined;
}

export const submitCheckInFn = createServerFn({ method: 'POST' })
  .inputValidator((input: FormData) => {
    if (!(input instanceof FormData)) throw new Error('Submit the check-in form with its documents.');
    return input;
  })
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { submitCheckIn } = await import('./checkIn.server');
    const file = (key: string): File | null => {
      const value = data.get(key);
      return value instanceof File && value.size > 0 ? value : null;
    };
    let details: unknown;
    try { details = JSON.parse(String(data.get('details') ?? '{}')); } catch { throw new Error('Check the form details and try again.'); }
    return submitCheckIn(await serviceDeps(), details, { front: file('front'), back: file('back'), visa: file('visa') }, requestIp());
  });

export const getGuestCheckInFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string().uuid(), accessToken: z.string().min(32).max(128) }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { guestCheckIn } = await import('./checkIn.server');
    return guestCheckIn(await serviceDeps(), data.id, data.accessToken);
  });

export const listCheckInsFn = createServerFn({ method: 'GET' }).middleware([requireCheckInStaff])
  .handler(async ({ context }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { listCheckIns } = await import('./checkIn.server');
    return listCheckIns(context.supabase);
  });

export const getCheckInDocumentFn = createServerFn({ method: 'POST' }).middleware([requireCheckInStaff])
  .inputValidator(z.object({ id: z.string().uuid(), kind: z.enum(['front', 'back', 'visa']), mode: z.enum(['view', 'download']) }))
  .handler(async ({ data, context }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { staffCheckInDocument } = await import('./checkIn.server');
    return staffCheckInDocument(context.supabase, data.id, data.kind, data.mode);
  });
