import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getConsoleOverview } from '@/admin/console.functions';
import { getBookingEngineStatus } from '@/admin/bookingConsole.functions';

export const Route = createFileRoute('/(admin)/admin/')({ component: Overview });

function Overview() {
  const fetchOverview = useServerFn(getConsoleOverview);
  const { data, error } = useQuery({ queryKey: ['console', 'overview'], queryFn: () => fetchOverview() });
  const fetchEngine = useServerFn(getBookingEngineStatus);
  const engine = useQuery({ queryKey: ['engine', 'status'], queryFn: () => fetchEngine() });
  if (error) return <p className="text-destructive">Could not load the console.</p>;
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const s = data.settings;
  const state = (on: boolean) => (!data.secretsConfigured ? 'Not configured' : on ? 'Connected' : 'Off');
  const pending = data.inventoryOverrides.filter((o: any) => o.pms_status !== 'synced').length;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-3"><CardHeader><CardTitle>Booking engine (xtsy.one/book)</CardTitle></CardHeader><CardContent className="space-y-2">
        {!engine.data ? <p className="text-sm text-muted-foreground">Checking…</p> : (
          <>
            <Badge variant={engine.data.dbReady && engine.data.blockers.length === 0 ? 'default' : 'secondary'}>
              {engine.data.dbReady && engine.data.blockers.length === 0 ? 'Live booking on' : 'WhatsApp enquiries (live booking off)'}
            </Badge>
            {engine.data.blockers.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{engine.data.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            )}
          </>
        )}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>PMS by XTSY (hotels)</CardTitle></CardHeader><CardContent className="space-y-2">
        <Badge variant={s.pms_enabled && data.secretsConfigured ? 'default' : 'secondary'}>{state(s.pms_enabled)}</Badge>
        <p className="text-sm text-muted-foreground">Last sync: {s.last_pms_sync_at ? new Date(s.last_pms_sync_at).toLocaleString() : 'never'}</p>
        <p className="text-sm">{pending} room change(s) waiting for PMS</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>POS by XTSY (restaurants)</CardTitle></CardHeader><CardContent className="space-y-2">
        <Badge variant={s.pos_enabled && data.secretsConfigured ? 'default' : 'secondary'}>{state(s.pos_enabled)}</Badge>
        <p className="text-sm text-muted-foreground">Live tables on Bistro page: {s.live_tables_showcase ? 'on' : 'off'}</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Properties</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
        {data.properties.map((p) => <p key={p.propertyId}>{p.name} · {p.units.length} room types</p>)}
        {data.outlets.map((o) => <p key={o.outletId}>{o.name}</p>)}
      </CardContent></Card>
      <Card className="md:col-span-3"><CardHeader><CardTitle>Recent activity</CardTitle></CardHeader><CardContent>
        {data.audit.length === 0 ? <p className="text-sm text-muted-foreground">No console actions yet.</p> : (
          <ul className="divide-y divide-border text-sm">{data.audit.map((a: any) => (
            <li key={a.id} className="flex justify-between gap-4 py-2"><span>{a.action}</span><span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span></li>
          ))}</ul>
        )}
      </CardContent></Card>
    </div>
  );
}
