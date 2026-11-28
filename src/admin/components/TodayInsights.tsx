import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Globe2, Moon, Search, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { getSearchDemand } from '@/admin/console.functions';
import { DateRangeBar, useConsoleRange } from '@/admin/components/DateRangeBar';
import { summarizeArrivals, type InsightArrival, type Tally } from '@/admin/insights';
import { CAMP_ID } from '@/admin/consoleProperties';
import type { CalendarRow } from '@/admin/inventoryCalendar';
import { cn } from '@/lib/utils';

const short = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const wd = new Intl.DateTimeFormat('en-IN', { weekday: 'narrow', timeZone: 'UTC' });

function Stat({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note?: string }) {
  return <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-xt-sand/80">{icon}{label}</p>
    <p className="mt-2 text-3xl font-extrabold tabular-nums text-xt-paper">{value}</p>
    {note && <p className="mt-1 text-xs text-xt-fog">{note}</p>}
  </div>;
}

function Bars({ title, items, empty }: { title: string; items: Tally[]; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return <div className="rounded-2xl border border-xt-line bg-white p-4">
    <h3 className="text-sm font-extrabold text-xt-ink">{title}</h3>
    {items.length === 0 ? <p className="mt-3 text-sm text-xt-mute">{empty}</p> : <ul className="mt-3 space-y-2">{items.map((i) => <li key={i.label} className="text-sm">
      <span className="flex justify-between gap-2"><span className="min-w-0 truncate text-xt-ink">{i.label}</span><span className="shrink-0 font-bold tabular-nums">{i.count}</span></span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-xt-cream"><span className="block h-full rounded-full bg-xt-crimson" style={{ width: `${(i.count / max) * 100}%` }} /></span>
    </li>)}</ul>}
  </div>;
}

/** Range-aware portfolio or property insights: arrivals, guest mix, forward occupancy and search demand. */
export function TodayInsights({ arrivals, rows, propertyIds, single }: { arrivals: InsightArrival[]; rows: CalendarRow[]; propertyIds: string[]; single?: string }) {
  const range = useConsoleRange('7d');
  const s = summarizeArrivals(arrivals.filter((a) => propertyIds.includes(a.propertyId)), range);
  const fetchDemand = useServerFn(getSearchDemand);
  const demand = useQuery({ queryKey: ['console', 'demand-latest'], queryFn: () => fetchDemand(), staleTime: 300_000 });
  const live = rows.filter((r) => propertyIds.includes(r.propertyId) && r.propertyId !== CAMP_ID);
  const nights = live[0]?.cells.map((c, i) => {
    let total = 0, free = 0;
    for (const r of live) { const cell = r.cells[i]; if (cell && !cell.sheetMissing) { total += cell.start; free += cell.free; } }
    return { night: c.night, occ: total ? Math.round(((total - free) / total) * 100) : 0 };
  }) ?? [];
  const peak = Math.max(1, ...s.perDay.map((d) => d.guests));
  const demandRows = (demand.data ?? []).filter((d) => propertyIds.includes(d.propertyId));

  return <section aria-label="Insights" className="space-y-4">
    <DateRangeBar fallback="7d" presets={['today', 'yesterday', '7d', '30d', 'custom']} />
    <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,var(--color-xt-ink),color-mix(in_oklab,var(--color-xt-ink)_80%,var(--color-xt-crimson)))] p-5 text-xt-paper sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-xt-sand/80">{single ? 'Property insights' : 'All properties · exclusive insights'}</p>
          <h2 className="xt-display mt-1 text-4xl leading-none sm:text-5xl">{range.label}</h2></div>
        <p className="text-sm text-xt-fog">{range.from === range.to ? short.format(new Date(`${range.from}T00:00:00Z`)) : `${short.format(new Date(`${range.from}T00:00:00Z`))} – ${short.format(new Date(`${range.to}T00:00:00Z`))}`}</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Users className="h-3.5 w-3.5" />} label="Check-ins" value={String(s.checkIns)} note={`${s.guests} guests`} />
        <Stat icon={<Moon className="h-3.5 w-3.5" />} label="Guest-nights" value={String(s.guestNights)} note={s.avgNights ? `${s.avgNights} nights average stay` : 'From check-out dates'} />
        <Stat icon={<Globe2 className="h-3.5 w-3.5" />} label="International" value={`${s.internationalPct}%`} note="of check-ins" />
        <Stat icon={<Search className="h-3.5 w-3.5" />} label="Search demand" value={demandRows.length ? `${Math.round((demandRows.reduce((n, d) => n + d.ratio, 0) / demandRows.length) * 100)}%` : '—'} note="of usual weekly Google appearances" />
      </div>
      {s.perDay.length > 1 && <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-xt-sand/80">Guests arriving per day</p>
        <div className="mt-2 flex h-24 items-end gap-1">{s.perDay.map((d) => <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.guests} guests`}>
          <span className="w-full rounded-t-md bg-xt-sand/80" style={{ height: `${Math.max(4, (d.guests / peak) * 80)}px` }} />
          {s.perDay.length <= 14 && <span className="text-[10px] text-xt-fog">{wd.format(new Date(`${d.day}T00:00:00Z`))}</span>}
        </div>)}</div>
      </div>}
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <Bars title="How guests found XTSY" items={s.sources} empty="No answers yet in this range." />
      <Bars title="Where guests come from" items={s.origins} empty="No check-ins in this range." />
      <Bars title="Purpose of travel" items={s.purposes} empty="No check-ins in this range." />
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-xt-line bg-white p-4">
        <h3 className="text-sm font-extrabold text-xt-ink">Occupancy · next 14 nights</h3>
        {nights.length === 0 ? <p className="mt-3 text-sm text-xt-mute">The campsite is enquiry-only, so it has no live occupancy.</p> : <div className="mt-3 flex h-32 items-end gap-1">{nights.map((n) => <div key={n.night} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${n.night}: ${n.occ}% full`}>
          <span className="text-[10px] font-bold tabular-nums text-xt-mute">{n.occ}</span>
          <span className={cn('w-full rounded-t-md', n.occ >= 90 ? 'bg-xt-crimson' : n.occ >= 60 ? 'bg-amber-500' : 'bg-emerald-600')} style={{ height: `${Math.max(4, n.occ * 0.8)}px` }} />
          <span className="text-[10px] text-xt-mute">{Number(n.night.slice(8, 10))}</span>
        </div>)}</div>}
      </div>
      <div className="rounded-2xl border border-xt-line bg-white p-4">
        <h3 className="text-sm font-extrabold text-xt-ink">Google search demand</h3>
        {demand.isLoading ? <p className="mt-3 text-sm text-xt-mute">Loading…</p> : demandRows.length === 0 ? <p className="mt-3 text-sm text-xt-mute">No reading yet. Refresh it from Smart pricing.</p> : <ul className="mt-3 space-y-3">{demandRows.map((d) => {
          const up = d.ratio >= 1;
          const max = Math.max(1, ...d.daily.map((x) => x.impressions));
          return <li key={d.propertyId} className="rounded-xl bg-xt-cream/60 p-3 text-sm">
            <div className="flex items-center justify-between gap-2"><span className="font-bold text-xt-ink">{d.propertyId === CAMP_ID ? 'Shnonpedeng / Dawki' : 'Shillong / New Shillong'}</span>
              <span className={cn('inline-flex items-center gap-1 font-extrabold', up ? 'text-emerald-700' : 'text-xt-crimson')}>{up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{Math.round(d.ratio * 100)}%</span></div>
            <p className="text-xs text-xt-mute">{d.recentImpressions.toLocaleString('en-IN')} appearances in the last 7 days vs {d.baselineWeekly.toLocaleString('en-IN')} usual · Google data to {d.windowEnd}</p>
            {d.daily.length > 0 && <div className="mt-2 flex h-10 items-end gap-px">{d.daily.map((x) => <span key={x.date} className="flex-1 rounded-t-sm bg-xt-ink/70" style={{ height: `${Math.max(2, (x.impressions / max) * 40)}px` }} title={`${x.date}: ${x.impressions}`} />)}</div>}
            {d.topQueries.length > 0 && <p className="mt-2 truncate text-xs text-xt-mute">Top: {d.topQueries.slice(0, 3).map((q) => q.query).join(' · ')}</p>}
          </li>;
        })}</ul>}
      </div>
    </div>
  </section>;
}
