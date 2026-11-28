import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { smartRate } from '@/booking/smartPricing';
import { getSmartPricing, saveSmartPricing } from '@/admin/console.functions';

type Rule = { roomTypeId: string; enabled: boolean; minRupees: number; maxRupees: number };

/** Super admin: automatic nightly prices within limits. `free` = free units tonight per room type. */
export function SmartPricingPanel({ free, today, demandMultiplier = 1 }: { free: Record<string, number | undefined>; today: string; demandMultiplier?: number }) {
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

  return <section className="border-t border-xt-line pt-6" aria-label="Room price boundaries">
    <h3 className="flex items-center gap-2 text-xl font-bold"><Sparkles className="h-5 w-5 text-xt-crimson" aria-hidden />Room price boundaries</h3>
    <p className="mt-1 text-xs text-xt-mute">When on, the nightly price on /book follows how full each room type is (up to +25% when nearly full, −10% for an empty night 2 days out), then the hostel's search demand above (−5% to +10%), never outside your lowest and highest. Off = approved base price.</p>
    {q.error && <p className="mt-2 text-sm text-destructive">Could not load smart pricing.</p>}
    <ul className="mt-3 divide-y divide-xt-line">{BOOKING_ROOM_TYPES.map((r) => {
      const d = draft[r.id]; if (!d) return null;
      const tonight = smartRate(r.rate, { ...d, demandMultiplier }, free[r.id] ?? r.units, r.units, today, today) / 100;
      const saved = q.data?.find((x: Rule) => x.roomTypeId === r.id);
      const changed = saved ? d.enabled !== saved.enabled || d.minRupees !== saved.minRupees || d.maxRupees !== saved.maxRupees : d.enabled || d.minRupees !== r.rate / 100 || d.maxRupees !== Math.round(r.rate / 100 * 1.25);
      const valid = Number.isInteger(d.minRupees) && Number.isInteger(d.maxRupees) && d.minRupees >= 1 && d.maxRupees <= 100000 && d.maxRupees >= d.minRupees;
      const current = smartRate(r.rate, saved ? { ...saved, demandMultiplier } : undefined, free[r.id] ?? r.units, r.units, today, today) / 100;
      const set = (patch: Partial<Rule>) => setDraft((x) => ({ ...x, [r.id]: { ...d, ...patch } }));
      return <li key={r.id} className="grid gap-3 py-4 text-sm xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] xl:items-center">
        <span className="min-w-0"><span className="font-semibold">{r.name}</span><span className="block text-xs text-xt-mute">Base ₹{(r.rate / 100).toLocaleString('en-IN')} · current tonight ₹{current.toLocaleString('en-IN')}</span>{changed && <span className="block text-xs text-xt-crimson">{valid ? `Unsaved preview ₹${tonight.toLocaleString('en-IN')}` : 'Enter whole-rupee limits; highest must not be below lowest.'}</span>}</span>
        <label className="flex min-h-[48px] items-center gap-2"><input type="checkbox" checked={d.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-5 w-5" />Auto</label>
        <label className="flex items-center gap-2 text-xs text-xt-mute">Minimum ₹<input aria-label={`Lowest price for ${r.name}`} type="number" min={1} max={100000} step={1} value={d.minRupees} onChange={(e) => set({ minRupees: Number(e.target.value) })} className="min-h-[48px] w-28 rounded-lg border border-xt-line px-2 text-base text-xt-ink" /></label>
        <label className="flex items-center gap-2 text-xs text-xt-mute">Maximum ₹<input aria-label={`Highest price for ${r.name}`} type="number" min={d.minRupees} max={100000} step={1} value={d.maxRupees} onChange={(e) => set({ maxRupees: Number(e.target.value) })} className="min-h-[48px] w-28 rounded-lg border border-xt-line px-2 text-base text-xt-ink" /></label>
        <Button aria-label={`Save limits for ${r.name}`} disabled={m.isPending || !valid} onClick={() => m.mutate(d)} className="min-h-12"><Save aria-hidden />Save limits</Button>
      </li>;
    })}</ul>
  </section>;
}
