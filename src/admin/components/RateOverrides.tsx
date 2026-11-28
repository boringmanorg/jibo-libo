import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { listRateOverrides, saveRateOverrides } from '@/admin/console.functions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const todayIso = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function useRateOverrides() {
  const list = useServerFn(listRateOverrides);
  return useQuery({ queryKey: ['console', 'rate-overrides'], queryFn: () => list() });
}

export function useSaveRates(onDone?: () => void) {
  const qc = useQueryClient();
  const save = useServerFn(saveRateOverrides);
  return useMutation({
    mutationFn: (v: { roomTypeIds: string[]; from: string; to: string; rupees: number | null }) => save({ data: v }),
    onSuccess: (r, v) => { toast.success(v.rupees === null ? 'Manual price cleared; /book uses the standard rate again' : `Price set for ${r.rooms} room type${r.rooms > 1 ? 's' : ''} × ${r.nights} night${r.nights > 1 ? 's' : ''}`); void qc.invalidateQueries({ queryKey: ['console'] }); onDone?.(); },
    onError: (e) => toast.error(e.message),
  });
}

/** Bulk manual price for hostel room types and a date range. Super admin only; smart pricing must be off. */
export function RateOverrides() {
  const q = useRateOverrides();
  const m = useSaveRates();
  const [picked, setPicked] = useState<string[]>([]);
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [price, setPrice] = useState('');
  const smartOn = new Set(q.data?.smartOn ?? []);
  const name = (id: string) => BOOKING_ROOM_TYPES.find((r) => r.id === id)?.name ?? id;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const n = Number(price);
  return (
    <Card><CardHeader><CardTitle>Change rates</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Set a manual nightly price (₹, before tax) for one or more room types and dates; /book charges it on those nights. A room type with smart pricing on must be switched off first on <Link to="/admin/pricing" className="font-semibold underline">Smart pricing</Link>.</p>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Room types</legend>
        {BOOKING_ROOM_TYPES.map((r) => { const locked = smartOn.has(r.id); return (
          <label key={r.id} className={`flex min-h-12 items-center gap-3 rounded-md border border-input px-3 text-sm ${locked ? 'opacity-50' : ''}`}>
            <input type="checkbox" className="h-5 w-5" disabled={locked} checked={picked.includes(r.id)} onChange={() => toggle(r.id)} />
            <span className="min-w-0 flex-1">{r.name}<span className="block text-xs text-muted-foreground">{locked ? 'Smart pricing on: turn it off first' : `Standard ${inr(r.rate / 100)}`}</span></span>
          </label>); })}
      </fieldset>
      <div className="grid gap-3 md:grid-cols-3">
        <div><Label htmlFor="rf">From</Label><Input id="rf" type="date" min={todayIso()} className="h-12 text-base" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label htmlFor="rt">To (inclusive)</Label><Input id="rt" type="date" min={from} className="h-12 text-base" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label htmlFor="rp">Nightly price (₹, before tax)</Label><Input id="rp" type="number" min={1} inputMode="numeric" className="h-12 text-base" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-12" disabled={m.isPending || !picked.length || !(n >= 1)} onClick={() => m.mutate({ roomTypeIds: picked, from, to, rupees: n })}>Set price</Button>
        <Button className="min-h-12" variant="outline" disabled={m.isPending || !picked.length} onClick={() => m.mutate({ roomTypeIds: picked, from, to, rupees: null })}>Clear manual price</Button>
      </div>
      {!!q.data?.overrides.length && (
        <div><p className="mb-2 text-sm font-medium">Upcoming manual prices</p>
          <ul className="max-h-72 divide-y divide-border overflow-y-auto text-sm">{q.data.overrides.map((o) => (
            <li key={o.roomTypeId + o.night} className="flex justify-between gap-2 py-2"><span>{o.night} · {name(o.roomTypeId)}</span><span className="font-semibold">{inr(o.rupees)}{smartOn.has(o.roomTypeId) ? ' (paused: smart pricing on)' : ''}</span></li>
          ))}</ul></div>
      )}
    </CardContent></Card>
  );
}
