import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { BedDouble } from 'lucide-react';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { floorLabels, takenLabels, type Allocation } from '@/checkin/allocation';
import { allocateCheckInRooms, releaseCheckInRooms } from '@/admin/console.functions';

type Row = { id: string; guestName: string; checkInDate: string; checkOutDate: string; totalGuests: number; roomTypeId: string; allocatedRoomTypeId: string; allocatedUnits: string[] };

const nextDay = (d: string) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

export function AllocationPanel({ row, all }: { row: Row; all: Row[] }) {
  const qc = useQueryClient();
  const allocate = useServerFn(allocateCheckInRooms);
  const release = useServerFn(releaseCheckInRooms);
  const [type, setType] = useState(row.allocatedRoomTypeId || row.roomTypeId);
  const [checkOut, setCheckOut] = useState(row.checkOutDate || nextDay(row.checkInDate));
  const [picked, setPicked] = useState<string[]>(row.allocatedRoomTypeId === type ? row.allocatedUnits : []);
  const t = BOOKING_ROOM_TYPES.find((r) => r.id === type);
  const preferred = BOOKING_ROOM_TYPES.find((r) => r.id === row.roomTypeId);
  const others: Allocation[] = all.filter((o) => o.allocatedRoomTypeId && o.checkOutDate).map((o) => ({ id: o.id, roomTypeId: o.allocatedRoomTypeId, units: o.allocatedUnits, checkIn: o.checkInDate, checkOut: o.checkOutDate }));
  const taken = useMemo(() => takenLabels(others, type, row.checkInDate, checkOut, row.id), [others, type, checkOut, row]);
  const done = () => { void qc.invalidateQueries({ queryKey: ['staff'] }); void qc.invalidateQueries({ queryKey: ['console'] }); };
  const save = useMutation({ mutationFn: () => allocate({ data: { id: row.id, roomTypeId: type, units: picked, checkOut } }), onSuccess: (r) => { toast.success(`Allocated ${picked.join(', ')}`); if (r.channel) toast(r.channel); done(); }, onError: (e) => toast.error((e as Error).message) });
  const free = useMutation({ mutationFn: () => release({ data: { id: row.id } }), onSuccess: () => { toast.success('Allocation released'); setPicked([]); done(); }, onError: (e) => toast.error((e as Error).message) });
  const toggle = (u: string) => setPicked((p) => p.includes(u) ? p.filter((x) => x !== u) : [...p, u]);

  return <div className="mt-4 rounded-2xl border border-xt-line bg-xt-cream/60 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-bold text-xt-ink"><BedDouble className="h-4 w-4" aria-hidden />Room allocation</p>
      {row.allocatedUnits.length > 0 && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Holding {row.allocatedUnits.join(', ')} until {row.checkOutDate}</span>}
    </div>
    <p className="mt-1 text-sm text-xt-mute">Guest prefers <strong className="text-xt-ink">{preferred?.name ?? row.roomTypeId}</strong> · {row.totalGuests} guest{row.totalGuests === 1 ? '' : 's'}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold text-xt-ink">Room type
        <select value={type} onChange={(e) => { setType(e.target.value); setPicked([]); }} className="mt-1 min-h-[48px] w-full rounded-xl border border-xt-line bg-white px-3 text-base">
          {BOOKING_ROOM_TYPES.map((r) => <option key={r.id} value={r.id}>{r.name} · ₹{(r.rate / 100).toLocaleString('en-IN')}</option>)}
        </select></label>
      <label className="text-sm font-semibold text-xt-ink">Check-out
        <input type="date" value={checkOut} min={nextDay(row.checkInDate)} onChange={(e) => setCheckOut(e.target.value)} className="mt-1 min-h-[48px] w-full rounded-xl border border-xt-line bg-white px-3 text-base" /></label>
    </div>
    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-xt-mute">Pick {t?.soldAs === 'bed' ? 'beds' : 'rooms'}</p>
    <div className="mt-2 flex flex-wrap gap-2">{floorLabels(type).map((u) => {
      const busy = taken.has(u); const on = picked.includes(u);
      return <button key={u} type="button" disabled={busy} aria-pressed={on} onClick={() => toggle(u)}
        className={`min-h-[48px] min-w-[56px] rounded-xl border px-3 text-sm font-bold transition ${busy ? 'cursor-not-allowed border-xt-line bg-xt-line/40 text-xt-mute line-through' : on ? 'border-xt-ink bg-xt-ink text-xt-sand' : 'border-xt-line bg-white text-xt-ink hover:border-xt-ink'}`}>{u}</button>;
    })}</div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={!picked.length || save.isPending} onClick={() => save.mutate()} className="min-h-[48px] rounded-full bg-xt-crimson px-5 text-sm font-bold text-white disabled:opacity-50">{save.isPending ? 'Saving…' : row.allocatedUnits.length ? 'Update allocation' : 'Allocate & hold'}</button>
      {row.allocatedUnits.length > 0 && <button type="button" disabled={free.isPending} onClick={() => free.mutate()} className="min-h-[48px] rounded-full border border-xt-line px-5 text-sm font-bold text-xt-ink">Release</button>}
    </div>
  </div>;
}
