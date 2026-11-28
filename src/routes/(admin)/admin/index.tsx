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
import { PageHead, SheetChip, STATUS_LABEL, dayMonth, inrWhole } from '@/admin/components/ConsoleBits';

export const Route = createFileRoute('/(admin)/admin/')({
  head: () => buildRouteHead({ path: '/admin', title: 'Today — XTSY Property Console', description: 'Private property-by-property arrivals, inventory, room prices and meal selections.', noIndex: true }),
  component: Today,
});

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
type Arrival = { id: string; propertyId: string; guestName: string; checkInDate: string; checkInTime: string; totalGuests: number; status: string };

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
    <PageHead title="Today" sub={longDate.format(new Date(`${data.today}T00:00:00Z`))}>{selected !== CAMP_ID && <SheetChip syncedAt={data.sheetSyncedAt} />}</PageHead>
    {properties.map((p) => {
      const camp = p.id === CAMP_ID;
      const inventory = propertyInventory(p.id);
      const enquiries = data.latestEnquiries.filter((e: { kind: string }) => enquiryProperty(e.kind) === p.id);
      const checkInRows = (arrivals.data ?? []).filter((r) => r.propertyId === p.id && r.checkInDate === data.today);
      return <section key={p.id} aria-label={p.name} className="space-y-5 border-b border-xt-line pb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-2xl font-extrabold text-xt-ink">{p.name}</h2><p className="mt-1 text-sm text-xt-mute">{p.location} · {camp ? 'WhatsApp enquiry-only · no live availability' : 'Live hostel inventory from the Google Sheet'}</p></div>
          <Link to="/admin/check-in" search={{ property: p.id }} className="inline-flex min-h-[48px] items-center gap-2 font-semibold text-xt-crimson">Self check-in QR <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-lg font-bold">{camp ? 'Configured inventory · not live' : 'Inventory tonight'}</h3>
            <ul className="divide-y divide-xt-line">{inventory.map((r) => {
              const cell = data.rows.find((row) => row.id === r.id)?.cells[0];
              return <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 font-semibold">{r.name}</span><span className="shrink-0 text-right text-xt-mute">{r.live ? cell?.sheetMissing ? 'Not in sheet' : cell ? `${cell.free} free / ${r.total} ${r.unit}${cell.closed ? ` · ${cell.closed} blocked` : ''}` : 'Unavailable' : `${r.total} ${r.unit} · capacity only`}</span></li>;
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
        <div className="grid gap-5 lg:grid-cols-2">
          <div><h3 className="mb-2 text-lg font-bold">Today’s self check-ins · {checkInRows.length}</h3>
            {arrivals.error ? <p className="text-sm text-destructive">Could not load check-ins.</p> : arrivals.isLoading ? <p className="text-sm text-xt-mute">Loading arrivals…</p> : checkInRows.length === 0 ? <p className="text-sm text-xt-mute">No self check-ins recorded for today.</p> : <ul className="divide-y divide-xt-line">{checkInRows.map((r) => <li key={r.id} className="py-3 text-sm"><strong>{r.guestName}</strong> · {r.checkInTime} · {r.totalGuests} guests<span className="block text-xt-mute">{r.status.replace(/_/g, ' ')}</span></li>)}</ul>}
          </div>
          <div><h3 className="mb-2 text-lg font-bold">Recent enquiries & selections</h3>
            {!data.inboxReady ? <p className="text-sm text-destructive">Could not load enquiries.</p> : enquiries.length === 0 ? <p className="text-sm text-xt-mute">No recent enquiries.</p> : <ul className="divide-y divide-xt-line">{enquiries.map((e: any) => <li key={e.id} className="py-3 text-sm"><strong>{e.guest_name}</strong> · {STATUS_LABEL[e.status]}<span className="block text-xt-mute">{dayMonth(e.check_in)} → {dayMonth(e.check_out)} · {e.guests} guests · {inrWhole(e.estimate_rupees)}</span><p className="mt-1 whitespace-pre-line break-words">{e.summary}</p></li>)}</ul>}
            <Link to="/admin/inbox" search={{ property: p.id }} className="inline-flex min-h-[48px] items-center gap-1 text-sm font-semibold text-xt-crimson">Open property inbox <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>;
    })}
    {scope === 'super' && !selected && <section aria-label="Upcoming properties"><h2 className="text-xl font-bold">Upcoming properties</h2>{UPCOMING_PROPERTIES.map((p) => <p key={p.name} className="mt-2 text-sm text-xt-mute">{p.name} · {p.city} · Upcoming, not open for booking or check-in</p>)}</section>}
  </div>;
}
