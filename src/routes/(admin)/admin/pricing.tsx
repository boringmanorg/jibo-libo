import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { RefreshCw, Search } from 'lucide-react';
import { buildRouteHead } from '@/lib/seo-head';
import { useConsoleScope } from '@/admin/consoleScope';
import { getTodaySummary } from '@/admin/consoleHome.functions';
import { getSearchDemand, refreshSearchDemand } from '@/admin/console.functions';
import { SmartPricingPanel } from '@/admin/components/SmartPricingPanel';
import { PageHead, Panel } from '@/admin/components/ConsoleBits';
import { propertyInventory } from '@/admin/consoleProperties';
import { MIN_RECENT } from '@/booking/demandIntent';

export const Route = createFileRoute('/(admin)/admin/pricing')({
  head: () => buildRouteHead({ path: '/admin/pricing', title: 'Smart pricing — XTSY Console', description: 'Owner-limited automatic room prices driven by occupancy and search demand.', noIndex: true }),
  component: PricingPage,
});

const NAMES: Record<string, string> = { 'XTSY-SHL-HOSTEL': 'XTSY Travellers Hostel', 'XTSY-SHN-CAMP': 'Shnonpedeng Riverside Camping by XTSY' };
const AREAS: Record<string, string> = { 'XTSY-SHL-HOSTEL': 'Shillong & New Shillong stay searches', 'XTSY-SHN-CAMP': 'Dawki, Shnongpdeng & Umngot river searches' };
const pct = (m: number) => (m === 1 ? 'No change' : `${m > 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%`);
const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

function PricingPage() {
  const scope = useConsoleScope();
  const fetchToday = useServerFn(getTodaySummary);
  const fetchDemand = useServerFn(getSearchDemand);
  const refresh = useServerFn(refreshSearchDemand);
  const qc = useQueryClient();
  const today = useQuery({ queryKey: ['console', 'today', scope], queryFn: () => fetchToday() });
  const demand = useQuery({ queryKey: ['console', 'search-demand'], queryFn: () => fetchDemand() });
  const m = useMutation({
    mutationFn: () => refresh(),
    onSuccess: (r) => { toast.success(`Read ${r.rows} search rows from Google`); void qc.invalidateQueries({ queryKey: ['console', 'search-demand'] }); void qc.invalidateQueries({ queryKey: ['console', 'smart-pricing'] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (scope !== 'super') return <div><PageHead title="Smart pricing" /><Panel><p className="text-[15px] text-xt-mute">Smart pricing is set by the super admin.</p></Panel></div>;
  const hostelDemand = demand.data?.find((d) => d.propertyId === 'XTSY-SHL-HOSTEL');

  return <div className="space-y-8">
    <PageHead title="Smart pricing" sub="Prices move only inside your lowest and highest, and only for room types you switch to Auto." />

    <section aria-label="Search demand" className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Search className="h-5 w-5 text-xt-crimson" aria-hidden />Search demand</h2>
          <p className="mt-1 text-sm text-xt-mute">How often Google showed xtsy.one for searches about each stay, whether or not anyone clicked. Last 7 days against the weekly average of the 4 weeks before. Searches about other places (Phe Phe falls, Jowai, Sohra, other states) are left out and never move a price.</p>
        </div>
        <button type="button" onClick={() => m.mutate()} disabled={m.isPending} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-xt-ink px-5 text-sm font-semibold text-xt-sand disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${m.isPending ? 'animate-spin' : ''}`} aria-hidden />{m.isPending ? 'Reading…' : 'Refresh search demand'}
        </button>
      </div>
      {demand.error && <p className="text-sm text-destructive">Could not load demand. {(demand.error as Error).message}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {(['XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP'] as const).map((id) => {
          const d = demand.data?.find((x) => x.propertyId === id);
          return <Panel key={id}>
            <h3 className="text-lg font-bold">{NAMES[id]}</h3>
            <p className="text-xs text-xt-mute">{AREAS[id]}</p>
            {!d ? <p className="mt-3 text-sm text-xt-mute">{demand.isLoading ? 'Loading…' : 'No reading yet. Press “Refresh search demand”.'}</p> : <>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-xs text-xt-mute">Last 7 days</dt><dd className="text-2xl font-extrabold tabular-nums">{d.recentImpressions}</dd></div>
                <div><dt className="text-xs text-xt-mute">Usual week</dt><dd className="text-2xl font-extrabold tabular-nums">{d.baselineWeekly}</dd></div>
                <div><dt className="text-xs text-xt-mute">Price effect</dt><dd className={`text-2xl font-extrabold ${d.multiplier > 1 ? 'text-emerald-700' : d.multiplier < 1 ? 'text-xt-crimson' : ''}`}>{pct(d.multiplier)}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-xt-mute">
                {d.recentImpressions < MIN_RECENT ? `Fewer than ${MIN_RECENT} appearances, so demand stays neutral. ` : `${Math.round(d.ratio * 100)}% of a usual week. `}
                Data to {d.windowEnd} · read {when.format(new Date(d.capturedAt))}
                {id === 'XTSY-SHN-CAMP' && ' · Advice only: camp prices stay fixed (WhatsApp enquiries, no live engine).'}
              </p>
              {d.topQueries.length > 0 && <ul className="mt-3 divide-y divide-xt-line text-sm">{d.topQueries.map((q) => <li key={q.query} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2"><span className="min-w-0 truncate">{q.query}</span><span className="shrink-0 tabular-nums text-xt-mute">{q.impressions} seen · {q.clicks} clicks</span></li>)}</ul>}
            </>}
          </Panel>;
        })}
      </div>
    </section>

    {today.data
      ? <SmartPricingPanel today={today.data.today} demandMultiplier={hostelDemand && Date.now() - Date.parse(hostelDemand.capturedAt) < 14 * 86_400_000 ? hostelDemand.multiplier : 1}
          free={Object.fromEntries(propertyInventory('XTSY-SHL-HOSTEL').map((r) => [r.id, today.data.rows.find((row) => row.id === r.id)?.cells[0]?.free]))} />
      : <p className="text-sm text-xt-mute">{today.error ? 'Could not load tonight’s inventory.' : 'Loading…'}</p>}
  </div>;
}
