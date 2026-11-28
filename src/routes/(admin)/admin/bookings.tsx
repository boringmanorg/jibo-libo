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
import { Textarea } from '@/components/ui/textarea';
import { cancelEngineBooking, changeEngineBookingDates, createEngineBalanceLink, getEngineBooking, listEngineBookings } from '@/admin/bookingConsole.functions';
import { NotSetUp, STATUS_LABEL, inr, selectCls } from '@/admin/components/engineBits';
import { findRoomType } from '@/booking/catalogue';
import { DateRangeBar, useConsoleRange } from '@/admin/components/DateRangeBar';
import { dayHeading, groupByDay, todayInIndiaIso } from '@/admin/dateRange';
import { PAYMENT_METHODS, type PaymentMethod } from '@/booking/payments/fees';

export const Route = createFileRoute('/(admin)/admin/bookings')({ component: Bookings });

function Bookings() {
  const list = useServerFn(listEngineBookings);
  const range = useConsoleRange('7d');
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [applied, setApplied] = useState(filters);
  const [openId, setOpenId] = useState<string | null>(null);
  const clean = { ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)), ...(applied.search ? {} : { from: range.from, to: range.to }) } as { status?: string; search?: string; from?: string; to?: string };
  const { data, error, isFetching } = useQuery({ queryKey: ['engine', 'bookings', clean], queryFn: () => list({ data: clean }) });

  if (error) return <p className="text-destructive">Could not load bookings.</p>;
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  if (!data.dbReady) return <NotSetUp />;

  return (
    <div className="space-y-6">
      <DateRangeBar fallback="7d" />
      <Card><CardContent className="grid gap-3 p-4 md:grid-cols-3">
        <div><Label htmlFor="st">Status</Label>
          <select id="st" className={selectCls} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div><Label htmlFor="q">Reference or guest</Label><Input id="q" className="h-12 text-base" placeholder="XTSY-…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
        <div className="flex items-end"><Button className="min-h-12 w-full" onClick={() => setApplied(filters)} disabled={isFetching}>Search</Button></div>
      </CardContent></Card>

      {data.rows.length === 0 ? <p className="text-sm text-muted-foreground">No bookings with check-in in this range. Bookings appear here once live booking is switched on.</p> : groupByDay(data.rows as any[], (b) => String(b.check_in)).map((d) => (
        <details key={d.day} open className="rounded-2xl border border-border">
        <summary className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 px-4 font-extrabold">{dayHeading(d.day, todayInIndiaIso())}<span className="text-sm font-semibold text-muted-foreground">{d.items.length} booking{d.items.length === 1 ? '' : 's'}</span></summary>
        <div className="overflow-x-auto border-t border-border"><table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="p-3">Reference</th><th>Guest</th><th>Dates</th><th>Status</th><th>Total</th><th>Balance</th><th>Channel</th><th /></tr></thead>
          <tbody>{d.items.map((b: any) => (
            <tr key={b.id} className="border-t border-border">
              <td className="p-3 font-mono">{b.reference}</td><td>{b.guest_name}</td><td>{b.check_in} → {b.check_out}</td>
              <td>{STATUS_LABEL[b.status] ?? b.status}</td><td>{inr(b.total_paise)}</td><td>{inr(b.balance_paise)}</td>
              <td><Badge variant={b.channel_status === 'synced' ? 'default' : b.channel_status === 'failed' ? 'destructive' : 'secondary'}>{b.channel_status}</Badge></td>
              <td><Button variant="ghost" className="min-h-12" onClick={() => setOpenId(openId === b.id ? null : b.id)}>{openId === b.id ? 'Close' : 'Open'}</Button></td>
            </tr>))}</tbody></table></div></details>
      ))}
      {openId && <BookingDetail id={openId} />}
    </div>
  );
}

function BookingDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const get = useServerFn(getEngineBooking);
  const { data, error } = useQuery({ queryKey: ['engine', 'booking', id], queryFn: () => get({ data: { id } }) });
  const change = useServerFn(changeEngineBookingDates);
  const cancel = useServerFn(cancelEngineBooking);
  const link = useServerFn(createEngineBalanceLink);
  const [ci, setCi] = useState(''); const [co, setCo] = useState('');
  const [by, setBy] = useState<'guest' | 'xtsy'>('guest'); const [reason, setReason] = useState('');
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['engine'] });
  const changeM = useMutation({ mutationFn: () => change({ data: { id, checkIn: ci, checkOut: co } }), onSuccess: (r) => { toast.success(r.extra ? `Dates changed. ${inr(r.extra)} added to the balance.` : 'Dates changed.'); refresh(); }, onError: (e) => toast.error(e.message) });
  const cancelM = useMutation({ mutationFn: () => cancel({ data: { id, by, reason } }), onSuccess: (r) => { toast.success(r.refund ? `Cancelled. Refund ${inr(r.refund)} from the Zoho dashboard.` : 'Cancelled. No refund (guest cancellation).'); refresh(); }, onError: (e) => toast.error(e.message) });
  const linkM = useMutation({ mutationFn: () => link({ data: { id, method: method || undefined } }), onSuccess: (r) => { void navigator.clipboard?.writeText(r.url); toast.success(`Balance link for ${inr(r.due)} copied.`); refresh(); }, onError: (e) => toast.error(e.message) });

  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data) return <p className="text-muted-foreground">Loading booking…</p>;
  const b = data.booking;
  const cancelled = String(b.status).startsWith('cancelled');

  return (
    <Card><CardHeader><CardTitle className="font-mono">{b.reference}</CardTitle></CardHeader><CardContent className="space-y-5 text-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <p><span className="text-muted-foreground">Guest</span><br />{b.guest_name} · {b.guest_phone}{b.guest_email ? ` · ${b.guest_email}` : ''}</p>
        <p><span className="text-muted-foreground">Stay</span><br />{b.check_in} → {b.check_out} · {b.guests} guest(s)</p>
        <p><span className="text-muted-foreground">Status</span><br />{STATUS_LABEL[b.status] ?? b.status}{b.cancel_reason ? ` · ${b.cancel_reason}` : ''}</p>
      </div>
      <table className="w-full"><tbody>
        {data.lines.map((l: any) => <tr key={l.id} className="border-t border-border"><td className="py-2">{findRoomType(l.room_type_id)?.name ?? l.room_type_id} × {l.units}</td><td>{inr(l.taxable_paise)}</td><td>GST {l.gst_bps / 100}%: {inr(l.gst_paise)}</td></tr>)}
        <tr className="border-t border-border font-medium"><td className="py-2">Total</td><td>{inr(b.total_paise)}</td><td>Advance {inr(b.advance_paise)} · Balance {inr(b.balance_paise)}</td></tr>
      </tbody></table>

      <div><p className="font-medium">Payments</p>{data.payments.length === 0 ? <p className="text-muted-foreground">None yet.</p> : (
        <ul className="divide-y divide-border">{data.payments.map((p: any) => <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
          <span>{p.kind} · {inr(p.amount_paise)}{p.gateway_charge_paise ? ` + ${inr(p.gateway_charge_paise)} charge` : ''} · {p.method_actual ?? p.method_declared ?? 'method not known'}</span>
          <span className="flex gap-2"><Badge variant={p.status === 'succeeded' ? 'default' : 'secondary'}>{p.status}</Badge>{p.link_url && <a className="underline" href={p.link_url} target="_blank" rel="noreferrer">link</a>}</span></li>)}</ul>)}</div>

      <div><p className="font-medium">Invoices</p>{data.invoices.length === 0 ? <p className="text-muted-foreground">None issued yet.</p> : (
        <ul>{data.invoices.map((i: any) => <li key={i.id} className="font-mono">{i.number} · {inr(Number(i.taxable_paise) + Number(i.gst_paise))}</li>)}</ul>)}</div>

      {!cancelled && <>
        <div className="space-y-2 border-t border-border pt-4"><p className="font-medium">Change dates (one change, at least 14 days before check-in)</p>
          {data.dateChange.allowed ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div><Label htmlFor="nci">New check-in</Label><Input id="nci" type="date" className="h-12 text-base" value={ci} onChange={(e) => setCi(e.target.value)} /></div>
              <div><Label htmlFor="nco">New check-out</Label><Input id="nco" type="date" className="h-12 text-base" value={co} onChange={(e) => setCo(e.target.value)} /></div>
              <div className="flex items-end"><Button className="min-h-12 w-full" disabled={!ci || !co || changeM.isPending} onClick={() => changeM.mutate()}>Change dates</Button></div>
            </div>
          ) : <p className="text-muted-foreground">{data.dateChange.reason}</p>}</div>

        <div className="space-y-2 border-t border-border pt-4"><p className="font-medium">Balance payment link</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div><Label htmlFor="pm">Payment method (optional)</Label><select id="pm" className={selectCls} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}>
              <option value="">Guest chooses</option>{PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
            <div className="flex items-end"><Button className="min-h-12 w-full" disabled={linkM.isPending} onClick={() => linkM.mutate()}>Create and copy link</Button></div>
          </div></div>

        <div className="space-y-2 border-t border-border pt-4"><p className="font-medium">Cancel booking</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div><Label htmlFor="cb">Cancelled by</Label><select id="cb" className={selectCls} value={by} onChange={(e) => setBy(e.target.value as 'guest' | 'xtsy')}>
              <option value="guest">Guest (no refund)</option><option value="xtsy">XTSY cannot provide the room (full refund)</option></select></div>
            <div className="md:col-span-2"><Label htmlFor="rs">Reason</Label><Textarea id="rs" className="text-base" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          </div>
          <Button variant="destructive" className="min-h-12" disabled={cancelM.isPending} onClick={() => { if (window.confirm(`Cancel ${b.reference}? This cannot be undone.`)) cancelM.mutate(); }}>Cancel booking</Button></div>
      </>}

      <div className="border-t border-border pt-4"><p className="font-medium">Channel manager messages</p>{data.channelLog.length === 0 ? <p className="text-muted-foreground">None yet.</p> : (
        <ul className="divide-y divide-border">{data.channelLog.map((c: any) => <li key={c.id} className="flex justify-between gap-2 py-2"><span>{c.message_type} · {c.detail}</span><Badge variant={c.status === 'ok' ? 'default' : 'destructive'}>{c.status}</Badge></li>)}</ul>)}</div>
    </CardContent></Card>
  );
}
