import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getConsoleOverview, getTableBoard, setIntegrationFlags, setTableSlot } from '@/admin/console.functions';

export const Route = createFileRoute('/(admin)/admin/restaurants')({ component: Restaurants });

const OUTLET = 'TAB-SHL-01';

function Restaurants() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const overview = useServerFn(getConsoleOverview);
  const board = useServerFn(getTableBoard);
  const setSlot = useServerFn(setTableSlot);
  const setFlags = useServerFn(setIntegrationFlags);
  const ov = useQuery({ queryKey: ['console', 'overview'], queryFn: () => overview() });
  const b = useQuery({ queryKey: ['console', 'board', date], queryFn: () => board({ data: { outletId: OUTLET, date } }) });
  const slotM = useMutation({
    mutationFn: (v: { time: string; state: 'closed' | 'open' }) => setSlot({ data: { outletId: OUTLET, date, ...v } }),
    onSuccess: (r) => { toast(r.posStatus === 'synced' ? 'Saved and sent to POS' : 'Saved — waiting for POS'); qc.invalidateQueries({ queryKey: ['console'] }); },
    onError: (e) => toast.error(e.message),
  });
  const showcase = ov.data?.settings.live_tables_showcase ?? false;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">TAB Bistro by XTSY</h2>
      <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <div><p className="font-medium">Live tables on the Bistro page</p>
          <p className="text-sm text-muted-foreground">Shows free table times to guests. Needs the POS connection switched on.</p></div>
        <Switch aria-label="Live tables showcase" checked={showcase} onCheckedChange={async (v) => { await setFlags({ data: { live_tables_showcase: v } }); qc.invalidateQueries({ queryKey: ['console'] }); }} />
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Table board</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="max-w-xs"><Label htmlFor="d">Date</Label><Input id="d" type="date" className="h-12 text-base" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {!b.data ? <p className="text-sm text-muted-foreground">Loading…</p> : (<>
          <p className="text-sm text-muted-foreground">Source: {b.data.source === 'pos' ? 'live POS' : 'Bistro service hours (POS not connected)'}. Tap a time to close or reopen it.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {b.data.slots.map((s) => (
              <button key={s.time} type="button" disabled={s.state === 'booked' || slotM.isPending}
                onClick={() => slotM.mutate({ time: s.time, state: s.state === 'closed' ? 'open' : 'closed' })}
                className={`min-h-12 rounded-md border text-sm ${s.state === 'closed' ? 'border-destructive bg-destructive/10 text-destructive' : s.state === 'booked' ? 'border-border bg-muted text-muted-foreground' : 'border-primary bg-primary/10'}`}>
                {s.time}<span className="block text-[11px]">{s.state}</span>
              </button>))}
          </div>
          <div><p className="mb-2 font-medium">Reservations and lunch preorders</p>
            {b.data.reservations.length === 0 ? <p className="text-sm text-muted-foreground">{b.data.source === 'pos' ? 'None for this date.' : 'Requests go to the desk WhatsApp until the POS is connected.'}</p> : (
              <ul className="divide-y divide-border text-sm">{b.data.reservations.map((r) => (
                <li key={r.reference} className="flex justify-between py-2"><span>{r.time} · {r.service} · {r.partySize} · {r.guestName}</span><Badge>{r.status}</Badge></li>))}</ul>)}
          </div>
        </>)}
      </CardContent></Card>
    </div>
  );
}
