/**
 * Public server functions for the guest booking engine. They run on the server with the
 * service-role client; guests never touch the database directly (the be_ tables are closed by RLS).
 */
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { PAYMENT_METHODS, type PaymentMethod } from './payments/fees';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const method = z.enum(PAYMENT_METHODS.map((m) => m.id) as [PaymentMethod, ...PaymentMethod[]]);
const rooms = z.array(z.object({ roomTypeId: z.string().max(60), units: z.number().int().min(1).max(8), guests: z.number().int().min(1).max(24) })).min(1).max(7);

/** Only our own hosts become payment return URLs (a forged Host header cannot redirect guests away). */
export function trustedOrigin(url: string | undefined): string {
  try {
    const u = new URL(url ?? '');
    if (u.hostname === 'xtsy.one' || u.hostname === 'www.xtsy.one' || u.hostname.endsWith('.lovable.app') || u.hostname === 'localhost') return u.origin;
  } catch {
    /* fall through */
  }
  return 'https://xtsy.one';
}

async function deps() {
  const { getServiceClient } = await import('@/admin/serviceClient.server');
  return { db: getServiceClient(), env: process.env, now: new Date() };
}

async function asResult<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const { EngineError } = await import('./publicEngine.core');
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof EngineError || e instanceof Error ? e.message : 'Something went wrong.' };
  }
}

export const getEngineStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const core = await import('./publicEngine.core');
  return core.engineStatus(await deps());
});

export const getBookPageDataFn = createServerFn({ method: 'GET' }).handler(async () => {
  const core = await import('./publicEngine.core');
  return core.bookPageData(await deps());
});

export const searchStaysFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ checkIn: date, checkOut: date }))
  .handler(async ({ data }) => {
    const core = await import('./publicEngine.core');
    return asResult(async () => core.searchStays(await deps(), data));
  });

export const quoteFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ checkIn: date, checkOut: date, rooms, breakfastGuests: z.number().int().min(0).max(24), method }))
  .handler(async ({ data }) => {
    const core = await import('./publicEngine.core');
    const { settingsFromRow } = await import('./consoleSettings');
    return asResult(async () => {
      const d = await deps();
      core.validateDates(data.checkIn, data.checkOut, d.now);
      const row = d.db ? (await d.db.from('be_settings').select('*').eq('id', 1).maybeSingle()).data : null;
      return core.quoteCheckout(data, settingsFromRow(row));
    });
  });

export const startCheckoutFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    checkIn: date, checkOut: date, rooms, breakfastGuests: z.number().int().min(0).max(24), method,
    guest: z.object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(10).max(20),
      email: z.string().trim().max(160),
      gender: z.enum(['female', 'male', 'other']),
      nationality: z.string().trim().max(60),
    }),
    policyAccepted: z.boolean(), femaleOnlyAck: z.boolean().optional(), skyViewAck: z.boolean().optional(),
    botToken: z.string().max(2048).optional(),
  }))
  .handler(async ({ data }) => {
    const core = await import('./publicEngine.core');
    const req = getRequest();
    const ip = req?.headers.get('cf-connecting-ip') ?? req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    return asResult(async () => core.startCheckout(await deps(), data, trustedOrigin(req?.url), ip));
  });

export const getPublicBookingFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ ref: z.string().max(20) }))
  .handler(async ({ data }) => {
    const core = await import('./publicEngine.core');
    return core.publicBooking(await deps(), data.ref.toUpperCase());
  });

/** Public half of the bot check, or null when it is not set up. */
export const getBotCheckConfigFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { botCheckSiteKey } = await import('./botCheck');
  return { siteKey: botCheckSiteKey(process.env) };
});
