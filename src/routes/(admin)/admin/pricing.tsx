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
import { SearchTrendPanel } from '@/admin/components/SearchTrendPanel';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/(admin)/admin/pricing')({
  head: () => buildRouteHead({ path: '/admin/pricing', title: 'Smart pricing — XTSY Console', description: 'Owner-limited automatic room prices driven by occupancy and search demand.', noIndex: true }),
  component: PricingPage,
});

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

    <section aria-label="Search demand" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Search className="h-5 w-5 text-xt-crimson" aria-hidden />Local search trends</h2>
          <p className="mt-2 text-sm text-xt-mute">Google Search Console appearances for xtsy.one, including searches without clicks. Not total searches across Google. Data usually arrives 2–3 days later; unrelated destinations are excluded.</p>
        </div>
        <Button onClick={() => m.mutate()} disabled={m.isPending} className="min-h-12">
          <RefreshCw className={m.isPending ? 'animate-spin' : ''} aria-hidden />{m.isPending ? 'Reading Google…' : 'Refresh Google data'}
        </Button>
      </div>
      {demand.error && <p role="alert" className="text-sm text-destructive">Could not load demand. {(demand.error as Error).message}</p>}
      <div className="grid gap-5 2xl:grid-cols-2">
        <SearchTrendPanel area="Shillong & New Shillong" subtitle="XTSY Travellers Hostel" reading={hostelDemand} loading={demand.isLoading} />
        <SearchTrendPanel area="Shnonpedeng & Dawki" subtitle="Shnonpedeng Riverside Camping by XTSY" reading={demand.data?.find((d) => d.propertyId === 'XTSY-SHN-CAMP')} loading={demand.isLoading} camp />
      </div>
    </section>

    {today.data
      ? <SmartPricingPanel today={today.data.today} demandMultiplier={hostelDemand && Date.now() - Date.parse(hostelDemand.capturedAt) < 14 * 86_400_000 ? hostelDemand.multiplier : 1}
          free={Object.fromEntries(propertyInventory('XTSY-SHL-HOSTEL').map((r) => [r.id, today.data.rows.find((row) => row.id === r.id)?.cells[0]?.free]))} />
      : <p className="text-sm text-xt-mute">{today.error ? 'Could not load tonight’s inventory.' : 'Loading…'}</p>}
  </div>;
}
