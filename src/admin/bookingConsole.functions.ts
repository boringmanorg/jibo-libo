/**
 * Admin-only server functions for the booking engine console. Each runs requireSuperAdmin
 * (admin@xtsy.one, confirmed, admin role) and uses that admin's database session.
 */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { settingsInput } from '@/booking/consoleSettings';
import { PAYMENT_METHODS, type PaymentMethod } from '@/booking/payments/fees';
import { requireSuperAdmin } from './adminAuth';
import * as core from './bookingConsole.core';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const deps = (context: unknown): core.ConsoleDeps => ({ db: (context as { supabase: unknown }).supabase, env: process.env, now: new Date() });
const method = z.enum(PAYMENT_METHODS.map((m) => m.id) as [PaymentMethod, ...PaymentMethod[]]);

export const getBookingEngineStatus = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => core.loadStatus(deps(context)));

export const saveBookingSettings = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(settingsInput)
  .handler(async ({ data, context }) => core.saveSettings(deps(context), data));

export const setBookingLaunchSwitch = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ on: z.boolean() }))
  .handler(async ({ data, context }) => core.setLaunchSwitch(deps(context), data.on));

export const listEngineBookings = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ status: z.string().max(30).optional(), from: date.optional(), to: date.optional(), search: z.string().max(60).optional() }))
  .handler(async ({ data, context }) => core.listBookings(deps(context), data));

export const getEngineBooking = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => core.getBooking(deps(context), data.id));

export const changeEngineBookingDates = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: z.string().uuid(), checkIn: date, checkOut: date }))
  .handler(async ({ data, context }) => core.changeDates(deps(context), data.id, data.checkIn, data.checkOut));

export const cancelEngineBooking = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: z.string().uuid(), by: z.enum(['guest', 'xtsy']), reason: z.string().max(500) }))
  .handler(async ({ data, context }) => core.cancelBooking(deps(context), data.id, data.by, data.reason));

export const createEngineBalanceLink = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: z.string().uuid(), method: method.optional() }))
  .handler(async ({ data, context }) => core.createBalanceLink(deps(context), data.id, data.method));

export const getChannelLog = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => core.channelLog(deps(context)));

export const runEngineNightAudit = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => core.runNightAudit(deps(context)));

export const getEngineAuditLog = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => core.auditLog(deps(context)));

export const listDateChangeRequests = createServerFn({ method: 'GET' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => core.listChangeRequests(deps(context)));

export const applyDateChangeRequest = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => core.applyChangeRequest(deps(context), data.id));

export const declineDateChangeRequest = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .inputValidator(z.object({ id: z.string().uuid(), reason: z.string().max(300) }))
  .handler(async ({ data, context }) => core.declineChangeRequest(deps(context), data.id, data.reason));
