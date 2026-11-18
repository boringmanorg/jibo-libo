/**
 * Free TAB Bistro table times, shown only when the super admin console has the POS
 * connection and the live-tables showcase both switched on. Otherwise renders nothing.
 */
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getLiveTables } from '@/admin/public.functions';

export function LiveTables() {
  const fetchLive = useServerFn(getLiveTables);
  const date = new Date().toISOString().slice(0, 10);
  const { data } = useQuery({ queryKey: ['live-tables', date], queryFn: () => fetchLive({ data: { outletId: 'TAB-SHL-01', date } }), staleTime: 60_000 });
  if (!data?.enabled || data.slots.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-border p-4">
      <p className="m-0 mb-2 font-semibold">Free tables today</p>
      <div className="flex flex-wrap gap-2">{data.slots.map((t) => <span key={t} className="rounded-md border border-border px-3 py-2 text-sm">{t}</span>)}</div>
    </div>
  );
}
