import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { getGuestFolio } from '@/admin/sales.functions';
import { SALES_METHODS } from '@/admin/sales';
import { PageHead, Panel } from '@/admin/components/ConsoleBits';

export const Route = createFileRoute('/(admin)/admin/guest-folio/$key')({ component: GuestFolioDetail });

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const PROP: Record<string, string> = { 'XTSY-SHL-HOSTEL': 'XTSY Travellers Hostel', 'XTSY-SHN-CAMP': 'Shnonpedeng Riverside Camping' };

function GuestFolioDetail() {
  const { key } = Route.useParams();
  const get = useServerFn(getGuestFolio);
  const q = useQuery({ queryKey: ['console', 'guest-folio', 'one', key], queryFn: () => get({ data: { key } }) });
  if (q.isLoading) return <p className="text-xt-mute">Loading…</p>;
  if (q.error || !q.data) return <p className="text-destructive">{(q.error as Error)?.message ?? 'Guest not found.'}</p>;
  const { summary: s, stays, payments } = q.data;
  const refOf = new Map(stays.map((x) => [x.enquiryId, x.reference]));
  return (
    <div className="space-y-4">
      <Link to="/admin/guest-folio" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-xt-mute hover:text-xt-ink"><ArrowLeft className="h-4 w-4" aria-hidden />All guests</Link>
      <PageHead title={s.name} sub={`${s.stays} stay${s.stays === 1 ? '' : 's'} · ${s.propertyIds.map((p) => PROP[p] ?? p).join(', ')}`} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Panel><p className="text-sm text-xt-mute">WhatsApp</p><a className="inline-flex min-h-11 items-center gap-2 font-mono font-semibold text-xt-pine" href={`https://wa.me/${key.length === 10 ? `91${key}` : key}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" aria-hidden />{s.phone}</a></Panel>
        <Panel><p className="text-sm text-xt-mute">Billed</p><p className="text-2xl font-extrabold tabular-nums">{inr(s.billed)}</p></Panel>
        <Panel><p className="text-sm text-xt-mute">Paid</p><p className="text-2xl font-extrabold tabular-nums">{inr(s.paid)}</p></Panel>
        <Panel><p className="text-sm text-xt-mute">Balance due</p><p className={`text-2xl font-extrabold tabular-nums ${s.balance > 0 ? 'text-xt-crimson' : 'text-xt-pine'}`}>{inr(s.balance)}</p></Panel>
      </div>
      <Panel>
        <h2 className="text-lg font-extrabold text-xt-ink">Stays</h2>
        <ul className="mt-2 divide-y divide-xt-line">{stays.map((x) => (
          <li key={x.enquiryId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm">
            <span className="min-w-0"><span className="font-semibold text-xt-ink">{x.checkIn} → {x.checkOut}</span> · {x.guests} guest{x.guests === 1 ? '' : 's'} · <span className="font-mono">{x.reference}</span><br /><span className="text-xt-mute">{PROP[x.propertyId] ?? x.propertyId} · {x.status} · paid {inr(x.paid)}</span></span>
            {x.invoice ? <Link to="/admin/sales-invoices/$id" params={{ id: x.invoice.id }} className="inline-flex min-h-11 items-center rounded-full border border-xt-line bg-white px-4 font-semibold">{x.invoice.number}</Link> : <Link to="/admin/inbox" search={{ property: x.propertyId as never }} className="inline-flex min-h-11 items-center text-xt-crimson">Open in Sales</Link>}
          </li>))}</ul>
      </Panel>
      <Panel>
        <h2 className="text-lg font-extrabold text-xt-ink">Payments</h2>
        {payments.length === 0 ? <p className="mt-2 text-sm text-xt-mute">No payments recorded.</p> : (
          <ul className="mt-2 divide-y divide-xt-line text-sm">{payments.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 py-2"><span>{p.paidOn} · {SALES_METHODS.find((m) => m.id === p.method)?.label ?? p.method} · <span className="font-mono">{refOf.get(p.enquiryId)}</span>{p.note ? ` · ${p.note}` : ''}</span><b>{inr(p.amount)}</b></li>))}</ul>
        )}
      </Panel>
    </div>
  );
}
