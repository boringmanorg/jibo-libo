import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requirePropertyAdmin } from '@/admin/adminAuth';
import { assertPropertyScope } from '@/admin/consoleScope';
import { AMENITIES, OTA_PLATFORMS, PROPERTY_TYPES, cleanSelection } from './propertySetup';

const propertyId = z.enum(['XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP']);

export const getPropertyProfileFn = createServerFn({ method: 'GET' }).middleware([requirePropertyAdmin])
  .inputValidator(z.object({ propertyId }))
  .handler(async ({ data, context }) => {
    assertPropertyScope(context.isSuperAdmin, data.propertyId);
    const { readProfile } = await import('./propertySetup.server');
    return readProfile(data.propertyId);
  });

export const savePropertyProfileFn = createServerFn({ method: 'POST' }).middleware([requirePropertyAdmin])
  .inputValidator(z.object({
    propertyId, propertyType: z.enum(PROPERTY_TYPES), displayName: z.string().trim().min(2).max(120), description: z.string().max(1500),
    address: z.string().max(300), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(),
    amenities: z.array(z.string().max(60)).max(40), otaPresence: z.array(z.string().max(30)).max(20), hiddenRoomTypes: z.array(z.string().max(60)).max(20),
  }))
  .handler(async ({ data, context }) => {
    assertPropertyScope(context.isSuperAdmin, data.propertyId);
    const { writeProfile } = await import('./propertySetup.server');
    await writeProfile({ ...data, amenities: cleanSelection(data.amenities, AMENITIES), otaPresence: cleanSelection(data.otaPresence, OTA_PLATFORMS) });
    return { ok: true };
  });

export const searchPlacesFn = createServerFn({ method: 'POST' }).middleware([requirePropertyAdmin])
  .inputValidator(z.object({ query: z.string().trim().min(3).max(120) }))
  .handler(async ({ data }) => {
    const { searchPlaces } = await import('./propertySetup.server');
    return searchPlaces(data.query);
  });

export const syncGooglePlaceFn = createServerFn({ method: 'POST' }).middleware([requirePropertyAdmin])
  .inputValidator(z.object({ propertyId, placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/) }))
  .handler(async ({ data, context }) => {
    assertPropertyScope(context.isSuperAdmin, data.propertyId);
    const { syncPlace } = await import('./propertySetup.server');
    return syncPlace(data.propertyId, data.placeId);
  });

/** Public, read-only: what /book shows about a property. */
export const getPublicPropertyProfileFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ propertyId }))
  .handler(async ({ data }) => {
    try {
      const { readProfile } = await import('./propertySetup.server');
      return await readProfile(data.propertyId);
    } catch {
      return null;
    }
  });
