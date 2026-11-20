/**
 * POST /api/public/hooks/sheet-availability: the Google Sheet's script sends date-wise availability.
 * Auth: "Authorization: Bearer <SHEET_SYNC_SECRET>" (set the same value in Lovable Cloud secrets and
 * in the sheet's Script Properties). Only room numbers, dates and counts are accepted.
 *
 * Each sync is the whole picture from `from` (today) to the sheet's last month: nights it no longer
 * sends are removed, so the website follows exactly what the sheet says now.
 */
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { aggregateSheet } from './sheetAvailability';

const body = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cells: z.array(z.object({
    roomNo: z.string().trim().min(1).max(10),
    night: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    free: z.number().int().min(0).max(50),
  })).max(20000),
});

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' } });

export async function handleSheetAvailability(request: Request): Promise<Response> {
  const secret = process.env['SHEET_SYNC_SECRET'];
  if (!secret) return json({ error: 'Sheet sync is not set up: add SHEET_SYNC_SECRET.' }, 503);
  const supplied = new TextEncoder().encode(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '');
  const expected = new TextEncoder().encode(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return json({ error: 'Unauthorized' }, 401);

  let parsed: z.infer<typeof body>;
  try { parsed = body.parse(await request.json()); } catch { return json({ error: 'Expected { cells: [{ roomNo, night, free }] }' }, 400); }

  const { availability, unknownRooms } = aggregateSheet(parsed.cells as never);
  const now = new Date().toISOString();
  const rows = Object.entries(availability).flatMap(([room_type_id, nights]) =>
    Object.entries(nights).map(([night, free]) => ({ room_type_id, night, free, synced_at: now })));

  const { getServiceClient } = await import('@/admin/serviceClient.server');
  const db = getServiceClient();
  if (!db) return json({ error: 'Database unavailable' }, 503);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('be_sheet_availability').upsert(rows.slice(i, i + 500), { onConflict: 'room_type_id,night' });
    if (error) return json({ error: 'Could not save availability', saved: i }, 500);
  }
  // Remove nights the sheet no longer has (older than this sync, from today on). An empty send never
  // wipes anything: that is more likely a broken sheet layout than a hostel with no rooms.
  let removed = 0;
  if (parsed.from && rows.length > 0) {
    const del = await db.from('be_sheet_availability').delete({ count: 'exact' }).gte('night', parsed.from).lt('synced_at', now);
    if (del.error) return json({ error: 'Saved, but could not clear old nights', saved: rows.length }, 500);
    removed = del.count ?? 0;
  }
  return json({ status: rows.length ? 'ok' : 'nothing-to-save', saved: rows.length, removed, roomTypes: Object.keys(availability).length, unknownRooms, syncedAt: now });
}
