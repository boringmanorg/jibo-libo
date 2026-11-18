/** Public, read-only: live Bistro tables, shown only when the console switches them on. */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { findOutlet } from '@/integrations/xtsy-saas/catalogue';

export const getLiveTables = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ outletId: z.string().max(40), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data }) => {
    const off = { enabled: false, slots: [] as string[] };
    if (!findOutlet(data.outletId)) return off;
    const { getServiceClient } = await import('./serviceClient.server');
    const db = getServiceClient();
    if (!db) return off;
    const { data: s } = await db.from('console_integration_settings').select('pos_enabled, live_tables_showcase').eq('id', 1).maybeSingle();
    if (!s?.pos_enabled || !s.live_tables_showcase) return off;
    const { getSaasEndpoint, saasRequest } = await import('@/integrations/xtsy-saas/client.server');
    const cfg = getSaasEndpoint();
    if (!cfg) return off;
    try {
      const [res, closed] = await Promise.all([
        saasRequest<{ slots: string[] }>(cfg, `/pos/v1/outlets/${data.outletId}/slots?date=${data.date}`, { method: 'GET' }),
        db.from('console_table_overrides').select('slot_time').match({ outlet_id: data.outletId, service_date: data.date, state: 'closed' }),
      ]);
      const shut = new Set((closed.data ?? []).map((c) => c.slot_time));
      return { enabled: true, slots: res.slots.filter((t) => !shut.has(t)) };
    } catch {
      return off;
    }
  });
