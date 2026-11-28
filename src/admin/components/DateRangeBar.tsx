import { useNavigate, useSearch } from '@tanstack/react-router';
import { CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FUTURE_PRESETS, futureOnly, RANGE_PRESETS, resolveRange, todayInIndiaIso, type DateRange, type RangePreset } from '@/admin/dateRange';

/** Reads the shared console range from the URL (?range=&from=&to=). */
export function useConsoleRange(fallback: RangePreset = 'today', future = false): DateRange {
  const s = useSearch({ strict: false }) as { range?: string; from?: string; to?: string };
  const today = todayInIndiaIso();
  const r = resolveRange(s.range, s.from, s.to, today, fallback);
  return future ? futureOnly(r, today) : r;
}

export function DateRangeBar({ fallback = 'today', presets, future = false }: { fallback?: RangePreset; presets?: RangePreset[]; future?: boolean }) {
  const range = useConsoleRange(fallback, future);
  const minDate = future ? todayInIndiaIso() : undefined;
  if (future && !presets) presets = FUTURE_PRESETS;
  const navigate = useNavigate();
  const set = (patch: Record<string, string | undefined>) =>
    void navigate({ to: '.', search: ((prev: Record<string, unknown>) => ({ ...prev, ...patch })) as never, replace: true });
  const list = RANGE_PRESETS.filter((p) => !presets || presets.includes(p.id));
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-xt-line bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <span className="flex items-center gap-2 text-sm font-bold text-xt-ink"><CalendarRange className="h-4 w-4" aria-hidden />Showing</span>
      <label className="sm:hidden">
        <select aria-label="Date range" className="min-h-[48px] w-full rounded-xl border border-xt-line bg-background px-3 text-base" value={range.preset} onChange={(e) => set({ range: e.target.value })}>
          {list.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <div role="tablist" aria-label="Date range" className="hidden flex-wrap gap-1 sm:flex">
        {list.map((p) => <button key={p.id} type="button" role="tab" aria-selected={range.preset === p.id} onClick={() => set({ range: p.id })}
          className={cn('min-h-[44px] rounded-full px-4 text-sm font-bold transition-colors', range.preset === p.id ? 'bg-xt-ink text-xt-sand' : 'text-xt-mute hover:bg-xt-cream hover:text-xt-ink')}>{p.label}</button>)}
      </div>
      {range.preset === 'custom' && <div className="flex flex-wrap items-center gap-2">
        <input type="date" aria-label="From date" className="min-h-[48px] rounded-xl border border-xt-line px-3 text-base" value={range.from} min={minDate} onChange={(e) => set({ range: 'custom', from: e.target.value })} />
        <span className="text-sm text-xt-mute">to</span>
        <input type="date" aria-label="To date" className="min-h-[48px] rounded-xl border border-xt-line px-3 text-base" value={range.to} min={range.from} onChange={(e) => set({ range: 'custom', to: e.target.value })} />
      </div>}
      <span className="text-xs text-xt-mute sm:ml-auto">{range.from === range.to ? range.from : `${range.from} → ${range.to}`}</span>
    </div>
  );
}
