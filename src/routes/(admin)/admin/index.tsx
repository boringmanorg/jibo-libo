import type { ReactNode } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSheetDoorbell } from '@/hooks/useSheetDoorbell';
import { buildRouteHead } from '@/lib/seo-head';
import { useServerFn } from '@tanstack/react-start';
import { ArrowRight } from 'lucide-react';
import { useConsoleProperty, useConsoleScope } from '@/admin/consoleScope';
import { CONSOLE_PROPERTIES, CAMP_ID, enquiryProperty, propertyInventory, propertyMeals, propertyRates } from '@/admin/consoleProperties';
import { UPCOMING_PROPERTIES } from '@/data/brandFacts';
import { getTodaySummary } from '@/admin/consoleHome.functions';
import { listCheckInsFn } from '@/checkin/checkIn.functions';
import { PageHead, SheetChip, inrWhole } from '@/admin/components/ConsoleBits';
import { TodayInsights } from '@/admin/components/TodayInsights';

export const Route = createFileRoute('/(admin)/admin/')({
  head: () => buildRouteHead({ path: '/admin', title: 'Today — XTSY Property Console', description: 'Private property-by-property arrivals, inventory, room prices and meal selections.', noIndex: true }),
  component: Today,
});

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
type Arrival = { id: string; propertyId: string; guestName: string; checkInDate: string; checkInTime: string; totalGuests: number; status: string; allocatedUnits: string[]; checkOutDate: string; isInternational: boolean; referralSource: string; purpose: string; state: string; country: string };

function Kpi({ label, value, note, tone = 'ink', children }: { label: string; value: string; note?: string; tone?: 'ink' | 'crimson' | 'green'; children?: ReactNode }) {
  const c = tone === 'crimson' ? 'text-xt-crimson' : tone === 'green' ? 'text-emerald-700' : 'text-xt-ink';
  return <div className="rounded-2xl border border-xt-line bg-white p-4 shadow-xs"><p className="text-xs font-semibold uppercase tracking-wider text-xt-mute">{label}</p><p className={`mt-2 text-3xl font-extrabold tabular-nums ${c}`}>{value}</p>{note && <p className="mt-1 text-xs text-xt-mute">{note}</p>}{children}</div>;
}

function Today() {
  const scope = useConsoleScope();
  const selected = useConsoleProperty();
  const fetchToday = useServerFn(getTodaySummary);
  const checkIns = useServerFn(listCheckInsFn);
  const { data, error } = useQuery({ queryKey: ['console', 'today', scope], queryFn: () => fetchToday() });
  const arrivals = useQuery({ queryKey: ['staff', 'self-check-ins', scope], queryFn: () => checkIns() as Promise<Arrival[]> });
  const qc = useQueryClient();
  useSheetDoorbell(() => { void qc.invalidateQueries({ queryKey: ['console'] }); });
  if (error) return <p className="text-destructive">Could not load today’s summary. {(error as Error).message}</p>;
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const properties = CONSOLE_PROPERTIES.filter((p) => (scope === 'super' || p.id === 'XTSY-SHL-HOSTEL') && (!selected || p.id === selected));

  return <div className="space-y-8">
    <PageHead title={selected ? (properties[0]?.name ?? 'Today') : 'Today · All properties'} sub={longDate.format(new Date(`${data.today}T00:00:00Z`))} />
    {(() => {
      // Occupancy counts every property in view that tracks live inventory. The campsite is
      // enquiry-only (no live counts), so it is listed as not tracked rather than counted as empty.
      const liveProps = properties.filter((p) => p.id !== CAMP_ID);
      let total = 0, free = 0;
      for (const p of liveProps) for (const r of propertyInventory(p.id)) { const c = data.rows.find((row) => row.id === r.id)?.cells[0]; if (c && !c.sheetMissing) { total += r.total; free += Math.max(0, c.free); } }
      const occ = total ? Math.round(((total - free) / total) * 100) : 0;
      const single = properties.length === 1 ? properties[0] : undefined;
      const occLabel = single ? (single.id === CAMP_ID ? 'Camp occupancy' : 'Hostel occupancy') : 'Overall occupancy';
      const notTracked = properties.filter((p) => p.id === CAMP_ID).length;
      const todays = (arrivals.data ?? []).filter((r) => r.checkInDate === data.today && properties.some((p) => p.id === r.propertyId));
      const pending = (arrivals.data ?? []).filter((r) => properties.some((p) => p.id === r.propertyId) && r.propertyId !== CAMP_ID && !r.allocatedUnits?.length && r.checkInDate >= data.today);
      const inHouse = (arrivals.data ?? []).filter((r) => properties.some((p) => p.id === r.propertyId) && r.allocatedUnits?.length && r.checkInDate <= data.today && r.checkOutDate > data.today);
      const newEnquiries = data.latestEnquiries.filter((e: { status: string; kind: string }) => e.status === 'new' && properties.some((p) => p.id === enquiryProperty(e.kind))).length;
      return <section aria-label="Portfolio at a glance" className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {single?.id === CAMP_ID
            ? <Kpi label={occLabel} value="—" note="Enquiry-only, not tracked live" />
            : <Kpi label={occLabel} value={`${occ}%`} note={`${total - free} of ${total} units taken tonight${notTracked ? ' · camp not tracked live' : ''}`} tone={occ >= 80 ? 'green' : 'ink'} />}
          <Kpi label="Free tonight" value={single?.id === CAMP_ID ? '—' : String(free)} note={single?.id === CAMP_ID ? 'Confirmed on WhatsApp' : 'beds + rooms, console wins'} />
          <Kpi label="Arrivals today" value={String(todays.length)} note={`${todays.reduce((n, r) => n + r.totalGuests, 0)} guests`} />
          <Kpi label="Awaiting room" value={String(pending.length)} note="self check-ins to allocate" tone={pending.length ? 'crimson' : 'ink'} />
          <Kpi label="New enquiries" value={String(newEnquiries)} tone={newEnquiries ? 'crimson' : 'ink'}><Link to="/admin/inbox" search={{ property: selected }} className="mt-1 inline-flex min-h-[48px] items-center gap-1 text-xs font-bold text-xt-crimson">Open inbox <ArrowRight className="h-3.5 w-3.5" /></Link></Kpi>
        </div>
        <p className="text-xs text-xt-mute">In house tonight: {inHouse.reduce((n, r) => n + r.totalGuests, 0)} guests</p>
        {pending.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-xt-blush px-4 py-3 text-sm"><strong className="text-xt-crimson-dark">Allocate rooms:</strong>{pending.slice(0, 6).map((r) => <span key={r.id} className="rounded-full bg-white px-3 py-1 font-semibold">{r.guestName} · {r.totalGuests}</span>)}<Link to="/admin/check-in" search={{ property: 'XTSY-SHL-HOSTEL' }} className="ml-auto inline-flex min-h-[48px] items-center gap-1 font-bold text-xt-crimson">Open desk <ArrowRight className="h-4 w-4" /></Link></div>}
      </section>;
    })()}
    <TodayInsights arrivals={arrivals.data ?? []} rows={data.rows} propertyIds={properties.map((p) => p.id)} {...(selected ? { single: selected } : {})} />
    {properties.map((p) => {
      const camp = p.id === CAMP_ID;
      const inventory = propertyInventory(p.id);
      const checkInRows = (arrivals.data ?? []).filter((r) => r.propertyId === p.id && r.checkInDate === data.today);
      return <details key={p.id} open={properties.length === 1} aria-label={p.name} className="group space-y-5 rounded-[28px] border border-xt-line bg-white p-5 sm:p-6">
        <summary className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 text-sm font-bold text-xt-mute"><span>Tonight’s operations · inventory, prices and meals</span><span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span></summary>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="text-2xl font-extrabold text-xt-ink">{p.name}</h2><p className="mt-1 text-sm text-xt-mute">{p.location} · {camp ? 'WhatsApp enquiry-only · no live availability' : 'Live inventory · console is the main record, Google Sheet kept in step'}</p>{!camp && <div className="mt-2"><SheetChip syncedAt={data.sheetSyncedAt} /></div>}</div>
          <Link to="/admin/check-in" search={{ property: p.id }} className="inline-flex min-h-[48px] items-center gap-2 font-semibold text-xt-crimson">Self check-in QR <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-lg font-bold">{camp ? 'Configured inventory · not live' : 'Inventory tonight'}</h3>
            <ul className="divide-y divide-xt-line">{inventory.map((r) => {
              const cell = data.rows.find((row) => row.id === r.id)?.cells[0];
              const pct = r.live && cell && !cell.sheetMissing ? Math.round(((r.total - Math.max(0, cell.free)) / r.total) * 100) : null;
              return <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3 text-sm"><span className="min-w-0 truncate font-semibold">{r.name}</span><span className="shrink-0 text-right text-xt-mute">{r.live ? cell?.sheetMissing ? 'Not in sheet' : cell ? `${cell.free} free / ${r.total} ${r.unit}${cell.closed ? ` · ${cell.closed} blocked` : ''}` : 'Unavailable' : `${r.total} ${r.unit} · capacity only`}</span>{pct !== null && <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-xt-line"><span className={`block h-full rounded-full ${pct >= 90 ? 'bg-xt-crimson' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} /></span>}</li>;
            })}</ul>
            {!camp && <Link to="/admin/inventory" search={{ property: p.id }} className="inline-flex min-h-[48px] items-center gap-1 text-sm font-semibold text-xt-crimson">Open inventory <ArrowRight className="h-4 w-4" /></Link>}
          </div>
          <div>
            <h3 className="mb-3 text-lg font-bold">Accommodation prices</h3>
            <ul className="divide-y divide-xt-line">{propertyRates(p.id).map((r) => <li key={r.id} className="flex items-start justify-between gap-3 py-3 text-sm"><span className="min-w-0 font-semibold">{r.name}<span className="block font-normal text-xt-mute">Up to {r.capacity} guest{r.capacity === 1 ? '' : 's'} per unit</span></span><span className="shrink-0 text-right">{inrWhole(r.rate)}<span className="block text-xs text-xt-mute">{r.unit}</span></span></li>)}</ul>
            <p className="mt-2 text-xs text-xt-mute">Approved base prices. GST and applicable fees are separate; meals are optional.</p>
          </div>
        </div>
        <details className="border-t border-xt-line pt-3">
          <summary className="flex min-h-[48px] cursor-pointer items-center text-lg font-bold">{camp ? 'Meal plan options' : 'Breakfast selections'} · {propertyMeals(p.id).length}</summary>
          <ul className="grid gap-x-6 sm:grid-cols-2">{propertyMeals(p.id).map((m) => <li key={m.id} className="flex items-start justify-between gap-3 border-b border-xt-line py-3 text-sm"><span className="font-semibold">{m.name}</span><span className="shrink-0 text-right">{inrWhole(m.price)}<span className="block text-xs text-xt-mute">{m.unit}</span></span></li>)}</ul>
        </details>
        <div><h3 className="mb-2 text-lg font-bold">Today’s self check-ins · {checkInRows.length}</h3>
          {arrivals.error ? <p className="text-sm text-destructive">Could not load check-ins.</p> : arrivals.isLoading ? <p className="text-sm text-xt-mute">Loading arrivals…</p> : checkInRows.length === 0 ? <p className="text-sm text-xt-mute">No self check-ins recorded for today.</p> : <ul className="divide-y divide-xt-line">{checkInRows.map((r) => <li key={r.id} className="py-3 text-sm"><strong>{r.guestName}</strong> · {r.checkInTime} · {r.totalGuests} guests<span className="block text-xt-mute">{r.status.replace(/_/g, ' ')}</span></li>)}</ul>}
        </div>
      </details>;
    })}
    {scope === 'super' && !selected && <section aria-label="Upcoming properties"><h2 className="text-xl font-bold">Upcoming properties</h2>{UPCOMING_PROPERTIES.map((p) => <p key={p.name} className="mt-2 text-sm text-xt-mute">{p.name} · {p.city} · Upcoming, not open for booking or check-in</p>)}</section>}
  </div>;
}
