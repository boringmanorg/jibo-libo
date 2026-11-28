import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { smartRate } from '@/booking/smartPricing';
import { getSmartPricing, saveSmartPricing } from '@/admin/console.functions';

type Rule = { roomTypeId: string; enabled: boolean; minRupees: number; maxRupees: number };

/** Super admin: automatic nightly prices within limits. `free` = free units tonight per room type. */
export function SmartPricingPanel({ free, today }: { free: Record<string, number | undefined>; today: string }) {
  const load = useServerFn(getSmartPricing);
  const save = useServerFn(saveSmartPricing);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['console', 'smart-pricing'], queryFn: () => load() });
  const [draft, setDraft] = useState<Record<string, Rule>>({});
  useEffect(() => {
    if (!q.data) return;
    setDraft(Object.fromEntries(BOOKING_ROOM_TYPES.map((r) => {
      const base = r.rate / 100;
      return [r.id, q.data.find((x: Rule) => x.roomTypeId === r.id) ?? { roomTypeId: r.id, enabled: false, minRupees: base, maxRupees: Math.round(base * 1.25) }];
    })));
  }, [q.data]);
  const m = useMutation({ mutationFn: (rule: Rule) => save({ data: rule }), onSuccess: () => { toast.success('Smart pricing saved'); void qc.invalidateQueries({ queryKey: ['console', 'smart-pricing'] }); }, onError: (e) => toast.error((e as Error).message) });

  return <div className="rounded-2xl border border-xt-line bg-white p-4">
    <h3 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-xt-crimson" aria-hidden />Smart pricing</h3>
    <p className="mt-1 text-xs text-xt-mute">When on, the nightly price on /book follows how full each room type is (up to +25% when nearly full, −10% for an empty night 2 days out), never outside your lowest and highest. Off = approved base price.</p>
    {q.error && <p className="mt-2 text-sm text-destructive">Could not load smart pricing.</p>}
    <ul className="mt-3 divide-y divide-xt-line">{BOOKING_ROOM_TYPES.map((r) => {
      const d = draft[r.id]; if (!d) return null;
      const tonight = smartRate(r.rate, d, free[r.id] ?? r.units, r.units, today, today) / 100;
      const set = (patch: Partial<Rule>) => setDraft((x) => ({ ...x, [r.id]: { ...d, ...patch } }));
      return <li key={r.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-center">
        <span className="min-w-0"><span className="font-semibold">{r.name}</span><span className="block text-xs text-xt-mute">Base ₹{(r.rate / 100).toLocaleString('en-IN')} · tonight ₹{tonight.toLocaleString('en-IN')}</span></span>
        <label className="flex min-h-[48px] items-center gap-2"><input type="checkbox" checked={d.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-5 w-5" />Auto</label>
        <label className="flex items-center gap-1 text-xs text-xt-mute">Low ₹<input aria-label={`Lowest price for ${r.name}`} type="number" min={1} value={d.minRupees} onChange={(e) => set({ minRupees: Number(e.target.value) })} className="min-h-[48px] w-24 rounded-lg border border-xt-line px-2 text-base text-xt-ink" /></label>
        <label className="flex items-center gap-1 text-xs text-xt-mute">High ₹<input aria-label={`Highest price for ${r.name}`} type="number" min={1} value={d.maxRupees} onChange={(e) => set({ maxRupees: Number(e.target.value) })} className="min-h-[48px] w-24 rounded-lg border border-xt-line px-2 text-base text-xt-ink" /></label>
        <button type="button" disabled={m.isPending} onClick={() => m.mutate(d)} className="min-h-[48px] rounded-full bg-xt-ink px-4 font-bold text-xt-sand disabled:opacity-50">Save</button>
      </li>;
    })}</ul>
  </div>;
}
