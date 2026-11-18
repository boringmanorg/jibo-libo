/**
 * App endpoints the site calls for stays (PMS) and restaurant tables (POS).
 * Writes are only forwarded when the integration flag is on; the WhatsApp enquiry flow stays the default.
 */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { ROOM_TYPES } from '@/config/roomTypes';
import { BISTRO_SLOT_RANGES } from '@/data/tabBistroHours';
import { findOutlet, findProperty } from './catalogue';
import type { PmsAvailabilityResponse, PosTableSlotsResponse, SaasWriteResult } from './types';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const phone = z.string().trim().regex(/^\+?[0-9 ]{8,16}$/);

export const getStayAvailability = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ propertyId: z.string().max(40), checkIn: date, checkOut: date, guests: z.number().int().min(1).max(40) }))
  .handler(async ({ data }): Promise<PmsAvailabilityResponse> => {
    const property = findProperty(data.propertyId);
    if (!property) throw new Error('Unknown property');
    const { getSaasConfig, saasRequest } = await import('./client.server');
    const cfg = getSaasConfig();
    if (cfg) {
      const live = await saasRequest<Omit<PmsAvailabilityResponse, 'source'>>(cfg, '/pms/v1/availability', { method: 'POST', body: data });
      return { ...live, source: 'pms' };
    }
    return {
      propertyId: property.propertyId,
      source: 'static',
      units: property.unitTypeIds.map((id) => ({
        unitTypeId: id,
        available: ROOM_TYPES[id].totalUnits,
        nightlyRate: ROOM_TYPES[id].basePrice,
        currency: property.currency,
      })),
    };
  });

export const sendStayEnquiryToPms = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    propertyId: z.string().max(40), unitTypeId: z.string().max(60), checkIn: date, checkOut: date,
    guests: z.number().int().min(1).max(40), guestName: z.string().trim().min(2).max(80), guestPhone: phone,
    notes: z.string().max(500).optional(),
  }))
  .handler(async ({ data }): Promise<SaasWriteResult> => {
    const property = findProperty(data.propertyId);
    if (!property || !property.unitTypeIds.includes(data.unitTypeId)) throw new Error('Unknown room');
    const { getSaasConfig, saasRequest } = await import('./client.server');
    const cfg = getSaasConfig();
    if (!cfg) return { forwarded: false, reason: 'pms-disabled' };
    const res = await saasRequest<{ reference: string }>(cfg, '/pms/v1/enquiries', { method: 'POST', body: data });
    return { forwarded: true, reference: res.reference };
  });

export const getTableSlots = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ outletId: z.string().max(40), date }))
  .handler(async ({ data }): Promise<PosTableSlotsResponse> => {
    const outlet = findOutlet(data.outletId);
    if (!outlet) throw new Error('Unknown outlet');
    const { getSaasConfig, saasRequest } = await import('./client.server');
    const cfg = getSaasConfig();
    if (cfg) {
      const live = await saasRequest<Omit<PosTableSlotsResponse, 'source'>>(cfg, `/pos/v1/outlets/${outlet.outletId}/slots?date=${data.date}`, { method: 'GET' });
      return { ...live, source: 'pos' };
    }
    return { outletId: outlet.outletId, date: data.date, slots: [], source: 'static' };
  });

export const sendTableRequestToPos = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    outletId: z.string().max(40), date, time: z.string().regex(/^\d{2}:\d{2}$/),
    service: z.enum(['breakfast', 'lunch-preorder', 'dinner']), partySize: z.number().int().min(1).max(40),
    guestName: z.string().trim().min(2).max(80), guestPhone: phone, notes: z.string().max(500).optional(),
  }))
  .handler(async ({ data }): Promise<SaasWriteResult> => {
    if (!findOutlet(data.outletId)) throw new Error('Unknown outlet');
    if (data.service !== 'lunch-preorder') {
      const [h, m] = data.time.split(':').map(Number);
      const mins = h * 60 + m;
      if (!BISTRO_SLOT_RANGES.some((r) => mins >= r.from && mins <= r.to)) throw new Error('Outside table service hours');
    }
    const { getSaasConfig, saasRequest } = await import('./client.server');
    const cfg = getSaasConfig();
    if (!cfg) return { forwarded: false, reason: 'pos-disabled' };
    const res = await saasRequest<{ reference: string }>(cfg, `/pos/v1/outlets/${data.outletId}/reservations`, { method: 'POST', body: data });
    return { forwarded: true, reference: res.reference };
  });
