import { useConsoleProperty } from '@/admin/consoleScope';
import { useSheetDoorbell } from '@/hooks/useSheetDoorbell';
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
  ALL_STAYS, WHOLE_PROPERTY, consoleCheckAvailability, listSheetLinks, setSheetLink, deleteInventoryOverride, getConsoleOverview, listPmsEnquiries, saveInventoryOverride, syncRoomsNow,
} from '@/admin/console.functions';


const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const plus = (d: string, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const selectCls = 'h-12 w-full rounded-md border border-input bg-background px-3 text-base';

/** Inventory → Bulk edit: room types and rates, multi-night/whole-property blocks and openings, sheet connection, availability check. */
export function InventoryBulk() {
  const qc = useQueryClient();
  const overview = useServerFn(getConsoleOverview);
  const { data } = useQuery({ queryKey: ['console', 'overview'], queryFn: () => overview() });
  useSheetDoorbell(() => { void qc.invalidateQueries({ queryKey: ['console'] }); });
  const fetchEnq = useServerFn(listPmsEnquiries);
  const enquiries = useQuery({ queryKey: ['console', 'enquiries'], queryFn: () => fetchEnq() });
  const save = useServerFn(saveInventoryOverride);
  const remove = useServerFn(deleteInventoryOverride);
  const sync = useServerFn(syncRoomsNow);
  const check = useServerFn(consoleCheckAvailability);

  const propertyId = useConsoleProperty() ?? 'XTSY-SHL-HOSTEL';
  const property = data?.properties.find((p) => p.propertyId === propertyId);
  const [unit, setUnit] = useState('');
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(plus(today(), 1));
  const [reason, setReason] = useState('');
  const [count, setCount] = useState('');
  const [ci, setCi] = useState(today());
  const [co, setCo] = useState(plus(today(), 1));
  const [guests, setGuests] = useState(2);

  const refresh = () => qc.invalidateQueries({ queryKey: ['console'] });
  const saveM = useMutation({
    mutationFn: (state: 'blocked' | 'open') => save({ data: { propertyId, unitTypeId: unit || property!.units[0].id, startDate: start, endDate: end, state, reason: reason || undefined, units: single && Number(count) > 0 && state === 'blocked' ? Number(count) : undefined } }),
    onSuccess: (r) => { toast.success(`${r.saved > 1 ? `${r.saved} rooms saved` : 'Saved'}${r.pmsStatus === 'synced' ? ' and sent to PMS' : '. The booking page uses it now; waiting for PMS'}`); setCount(''); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const syncM = useMutation({ mutationFn: () => sync(), onSuccess: (r) => { toast(r.message); refresh(); } });
  const checkM = useMutation({ mutationFn: () => check({ data: { propertyId, checkIn: ci, checkOut: co, guests } }), onError: (e) => toast.error(e.message) });

  if (!data || !property) return <p className="text-muted-foreground">Loading…</p>;
  const chosen = unit || property.units[0].id;
  const single = chosen !== WHOLE_PROPERTY && chosen !== ALL_STAYS;
  const chosenUnit = property.units.find((u) => u.id === chosen);
  const name = (id: string) => property.units.find((u) => u.id === id)?.name ?? id;
  const overrides = data.inventoryOverrides.filter((o: any) => o.property_id === propertyId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1"><p className="py-3 font-semibold">{property.name}</p></div>
        <Button className="min-h-12" onClick={() => syncM.mutate()} disabled={syncM.isPending}>{syncM.isPending ? 'Syncing…' : 'Sync rooms with PMS'}</Button>
      </div>

      <Card><CardHeader><CardTitle>Room types</CardTitle></CardHeader><CardContent>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">Room</th><th>Units</th><th>Nightly rate (₹, before tax)</th></tr></thead>
          <tbody>{property.units.map((u) => <tr key={u.id} className="border-t border-border"><td className="py-2">{u.name}</td><td>{u.totalUnits}</td><td>{u.rate.toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>
        <p className="mt-2 text-xs text-muted-foreground">Rates come from the PMS when connected; until then, from the site's approved prices.</p>
      </CardContent></Card>

      <SheetLinks syncedAt={data.sheetSyncedAt} />

      <Card><CardHeader><CardTitle>Bulk block or open dates</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Blocks show on the guest booking page (/book) straight away: blocked nights read “Full”, and guests can’t pick more beds or rooms than are left.</p>
        <div className="grid gap-3 md:grid-cols-5">
          <div><Label htmlFor="unit">Room</Label><select id="unit" className={selectCls} value={chosen} onChange={(e) => { setUnit(e.target.value); setCount(''); }}>
            <option value={WHOLE_PROPERTY}>Whole property: every {property.propertyId === 'XTSY-SHL-HOSTEL' ? 'room, including Experience by XTSY,' : 'tent'} at {property.name}</option>
            
            {property.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div><Label htmlFor="bn">How many to close</Label><Input id="bn" type="number" min={1} max={chosenUnit?.totalUnits ?? 1} inputMode="numeric" className="h-12 text-base" disabled={!single}
            placeholder={single ? `All ${chosenUnit?.totalUnits ?? ''}` : 'All'} value={count} onChange={(e) => setCount(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">{single ? `Leave blank to close all ${chosenUnit?.totalUnits ?? ''}.` : 'Closes every bed and room.'}</p></div>
          <div><Label htmlFor="bs">From</Label><Input id="bs" type="date" min={today()} className="h-12 text-base" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label htmlFor="be">To (inclusive)</Label><Input id="be" type="date" min={start} className="h-12 text-base" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div><Label htmlFor="br">Reason</Label><Input id="br" className="h-12 text-base" placeholder="Maintenance" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-12" variant="destructive" onClick={() => saveM.mutate('blocked')} disabled={saveM.isPending}>Block dates</Button>
          <Button className="min-h-12" variant="outline" onClick={() => saveM.mutate('open')} disabled={saveM.isPending}>Open dates</Button>
        </div>
        {overrides.length > 0 && (
          <ul className="divide-y divide-border text-sm">{overrides.map((o: any) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{o.state === 'blocked' ? 'Blocked' : 'Opened'} · {name(o.unit_type_id)}{o.state === 'blocked' && o.units ? ` (${o.units} of ${property.units.find((u) => u.id === o.unit_type_id)?.totalUnits ?? '?'})` : ''} · {o.start_date} → {o.end_date}{o.reason ? ` · ${o.reason}` : ''}</span>
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

/** Google Sheet connection: approve the pairing code the sheet shows, see the last sync, disconnect. */
function SheetLinks({ syncedAt }: { syncedAt: string | null }) {
  const qc = useQueryClient();
  const list = useServerFn(listSheetLinks);
  const set = useServerFn(setSheetLink);
  const q = useQuery({ queryKey: ['console', 'sheet-links'], queryFn: () => list(), refetchInterval: 15_000 });
  const m = useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'revoke' }) => set({ data: v }),
    onSuccess: (_r, v) => { toast.success(v.action === 'approve' ? 'Sheet connected. Choose XTSY → Set up automatic sync in the sheet.' : 'Disconnected'); void qc.invalidateQueries({ queryKey: ['console'] }); },
    onError: (e) => toast.error(e.message),
  });
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'never');
  const links = q.data?.links ?? [];
  return (
    <Card><CardHeader><CardTitle>Availability from your Google Sheet</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
      <p>{syncedAt ? <>Last received <span className="font-semibold">{when(syncedAt)}</span>.</> : 'Not connected yet.'} Every change you save in the sheet is published at the next minute, when every open booking page updates together. Only room numbers, dates and counts are sent; the sheet is never written to.</p>
      {!q.data?.ready && q.data && <p className="text-muted-foreground">Connections appear once this update’s database change has run.</p>}
      {links.length === 0 && q.data?.ready && <p className="text-muted-foreground">In the sheet, choose XTSY → Connect to xtsy.one. A pairing code appears there and here; approve it to connect. No password is needed.</p>}
      <ul className="divide-y divide-border">
        {links.map((l: any) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>
              <span className="font-medium">{l.label}</span>{' '}
              {l.status === 'pending'
                ? <Badge variant="secondary">Waiting for approval · code {l.pair_code}</Badge>
                : <Badge>Connected</Badge>}
              <span className="block text-muted-foreground">{l.status === 'pending' ? `Asked ${when(l.created_at)}. Approve only if the sheet shows the same code.` : `Last sync ${when(l.last_sync_at)}${l.last_sync_rows ? ` · ${l.last_sync_rows} room-nights` : ''}`}</span>
            </span>
            <span className="flex gap-2">
              {l.status === 'pending' && <Button className="min-h-11" disabled={m.isPending} onClick={() => m.mutate({ id: l.id, action: 'approve' })}>Approve</Button>}
              <Button variant="outline" className="min-h-11" disabled={m.isPending} onClick={() => m.mutate({ id: l.id, action: 'revoke' })}>{l.status === 'pending' ? 'Reject' : 'Disconnect'}</Button>
            </span>
          </li>
        ))}
      </ul>
    </CardContent></Card>
  );
}

