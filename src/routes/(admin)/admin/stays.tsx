import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  consoleCheckAvailability, deleteInventoryOverride, getConsoleOverview, listPmsEnquiries, saveInventoryOverride, syncRoomsNow,
} from '@/admin/console.functions';

export const Route = createFileRoute('/(admin)/admin/stays')({ component: Stays });

const today = () => new Date().toISOString().slice(0, 10);
const plus = (d: string, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const selectCls = 'h-12 w-full rounded-md border border-input bg-background px-3 text-base';

function Stays() {
  const qc = useQueryClient();
  const overview = useServerFn(getConsoleOverview);
  const { data } = useQuery({ queryKey: ['console', 'overview'], queryFn: () => overview() });
  const fetchEnq = useServerFn(listPmsEnquiries);
  const enquiries = useQuery({ queryKey: ['console', 'enquiries'], queryFn: () => fetchEnq() });
  const save = useServerFn(saveInventoryOverride);
  const remove = useServerFn(deleteInventoryOverride);
  const sync = useServerFn(syncRoomsNow);
  const check = useServerFn(consoleCheckAvailability);

  const [propertyId, setPropertyId] = useState('XTSY-SHL-HOSTEL');
  const property = data?.properties.find((p) => p.propertyId === propertyId);
  const [unit, setUnit] = useState('');
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(plus(today(), 1));
  const [reason, setReason] = useState('');
  const [ci, setCi] = useState(today());
  const [co, setCo] = useState(plus(today(), 1));
  const [guests, setGuests] = useState(2);

  const refresh = () => qc.invalidateQueries({ queryKey: ['console'] });
  const saveM = useMutation({
    mutationFn: (state: 'blocked' | 'open') => save({ data: { propertyId, unitTypeId: unit || property!.units[0].id, startDate: start, endDate: end, state, reason: reason || undefined } }),
    onSuccess: (r) => { toast.success(r.pmsStatus === 'synced' ? 'Saved and sent to PMS' : 'Saved — waiting for PMS'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const syncM = useMutation({ mutationFn: () => sync(), onSuccess: (r) => { toast(r.message); refresh(); } });
  const checkM = useMutation({ mutationFn: () => check({ data: { propertyId, checkIn: ci, checkOut: co, guests } }), onError: (e) => toast.error(e.message) });

  if (!data || !property) return <p className="text-muted-foreground">Loading…</p>;
  const name = (id: string) => property.units.find((u) => u.id === id)?.name ?? id;
  const overrides = data.inventoryOverrides.filter((o: any) => o.property_id === propertyId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1"><Label htmlFor="prop">Property</Label>
          <select id="prop" className={selectCls} value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setUnit(''); checkM.reset(); }}>
            {data.properties.map((p) => <option key={p.propertyId} value={p.propertyId}>{p.name}</option>)}
          </select></div>
        <Button className="min-h-12" onClick={() => syncM.mutate()} disabled={syncM.isPending}>{syncM.isPending ? 'Syncing…' : 'Sync rooms with PMS'}</Button>
      </div>

      <Card><CardHeader><CardTitle>Room types</CardTitle></CardHeader><CardContent>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">Room</th><th>Units</th><th>Nightly rate (₹, before tax)</th></tr></thead>
          <tbody>{property.units.map((u) => <tr key={u.id} className="border-t border-border"><td className="py-2">{u.name}</td><td>{u.totalUnits}</td><td>{u.rate.toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>
        <p className="mt-2 text-xs text-muted-foreground">Rates come from the PMS when connected; until then, from the site's approved prices.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Block or open dates</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label htmlFor="unit">Room</Label><select id="unit" className={selectCls} value={unit || property.units[0].id} onChange={(e) => setUnit(e.target.value)}>
            {property.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div><Label htmlFor="bs">From</Label><Input id="bs" type="date" className="h-12 text-base" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label htmlFor="be">To (inclusive)</Label><Input id="be" type="date" className="h-12 text-base" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div><Label htmlFor="br">Reason</Label><Input id="br" className="h-12 text-base" placeholder="Maintenance" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-12" variant="destructive" onClick={() => saveM.mutate('blocked')} disabled={saveM.isPending}>Block dates</Button>
          <Button className="min-h-12" variant="outline" onClick={() => saveM.mutate('open')} disabled={saveM.isPending}>Open dates</Button>
        </div>
        {overrides.length > 0 && (
          <ul className="divide-y divide-border text-sm">{overrides.map((o: any) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{o.state === 'blocked' ? 'Blocked' : 'Opened'} · {name(o.unit_type_id)} · {o.start_date} → {o.end_date}{o.reason ? ` · ${o.reason}` : ''}</span>
              <span className="flex items-center gap-2"><Badge variant={o.pms_status === 'synced' ? 'default' : o.pms_status === 'failed' ? 'destructive' : 'secondary'}>{o.pms_status === 'pending' ? 'waiting for PMS' : o.pms_status}</Badge>
                <Button variant="ghost" className="min-h-12" onClick={async () => { await remove({ data: { id: o.id } }); refresh(); }}>Remove</Button></span>
            </li>))}</ul>
        )}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Check availability</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label htmlFor="ci">Check-in</Label><Input id="ci" type="date" className="h-12 text-base" value={ci} onChange={(e) => setCi(e.target.value)} /></div>
          <div><Label htmlFor="co">Check-out</Label><Input id="co" type="date" className="h-12 text-base" value={co} onChange={(e) => setCo(e.target.value)} /></div>
          <div><Label htmlFor="gu">Guests</Label><Input id="gu" type="number" min={1} max={40} className="h-12 text-base" value={guests} onChange={(e) => setGuests(Number(e.target.value) || 1)} /></div>
          <div className="flex items-end"><Button className="min-h-12 w-full" onClick={() => checkM.mutate()} disabled={checkM.isPending}>Check</Button></div>
        </div>
        {checkM.data && (
          <div className="text-sm"><p className="mb-2 text-muted-foreground">Source: {checkM.data.source === 'pms' ? 'live PMS' : 'site room list + your blocks'}</p>
            <ul className="divide-y divide-border">{checkM.data.units.map((u) => (
              <li key={u.unitTypeId} className="flex justify-between py-2"><span>{name(u.unitTypeId)}</span><span>{u.blocked ? 'Blocked' : `${u.available} free · ₹${u.nightlyRate.toLocaleString('en-IN')}`}</span></li>
            ))}</ul></div>
        )}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Enquiries and bookings</CardTitle></CardHeader><CardContent>
        {!enquiries.data ? <p className="text-sm text-muted-foreground">Loading…</p> : !enquiries.data.connected ? (
          <p className="text-sm text-muted-foreground">PMS is not connected. Guest enquiries currently go to the desk WhatsApp; they will appear here once the PMS is switched on.</p>
        ) : enquiries.data.items.length === 0 ? <p className="text-sm text-muted-foreground">No enquiries.</p> : (
          <ul className="divide-y divide-border text-sm">{enquiries.data.items.map((e) => (
            <li key={e.reference} className="flex flex-wrap justify-between gap-2 py-2"><span>{e.reference} · {e.guestName} · {e.checkIn} → {e.checkOut} · {e.guests} guests</span><Badge>{e.status}</Badge></li>
          ))}</ul>
        )}
      </CardContent></Card>
    </div>
  );
}
