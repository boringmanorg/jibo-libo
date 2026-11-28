import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Search, Users, ReceiptText } from 'lucide-react';
import { listGuestFolios, listSalesInvoices } from '@/admin/sales.functions';
import { PageHead, Panel } from '@/admin/components/ConsoleBits';
import { useConsoleProperty, useConsoleScope } from '@/admin/consoleScope';
import { buildRouteHead } from '@/lib/seo-head';

export const Route = createFileRoute('/(admin)/admin/guest-folio/')({
  head: () => buildRouteHead({ path: '/admin/guest-folio', title: 'Guest Folio — XTSY Console', description: 'Private guest records, payments and invoices per property.', noIndex: true }),
  component: GuestFolioList,
});

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const PROP: Record<string, string> = { 'XTSY-SHL-HOSTEL': 'Hostel', 'XTSY-SHN-CAMP': 'Camp' };
type PropId = 'XTSY-SHL-HOSTEL' | 'XTSY-SHN-CAMP';

function GuestFolioList() {
  const list = useServerFn(listGuestFolios);
  const invoices = useServerFn(listSalesInvoices);
  const property = useConsoleProperty() as PropId | undefined;
  const isSuper = useConsoleScope() === 'super';
  const [tab, setTab] = useState<'guests' | 'invoices'>('guests');
  const [q, setQ] = useState('');
  const guests = useQuery({ queryKey: ['console', 'guest-folio', property ?? 'all', q], queryFn: () => list({ data: { propertyId: property, q: q || undefined } }) });
  const inv = useQuery({ queryKey: ['console', 'sales-invoices', property ?? 'all'], queryFn: () => invoices({ data: { propertyId: property } }), enabled: tab === 'invoices' });
  const g = guests.data ?? [];
  const due = g.reduce((a, x) => a + Math.max(0, x.balance), 0);

  return (
    <div className="space-y-4">
      <PageHead title="Guest Folio" sub={`Every guest's stays, payments and invoices in one place${isSuper && !property ? ', across all properties' : ''}.`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel><p className="text-sm text-xt-mute">Guests</p><p className="text-3xl font-extrabold tabular-nums">{g.length}</p></Panel>
        <Panel><p className="text-sm text-xt-mute">Collected</p><p className="text-3xl font-extrabold tabular-nums">{inr(g.reduce((a, x) => a + x.paid, 0))}</p></Panel>
        <Panel><p className="text-sm text-xt-mute">Balance due on invoices</p><p className={`text-3xl font-extrabold tabular-nums ${due > 0 ? 'text-xt-crimson' : ''}`}>{inr(due)}</p></Panel>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {([['guests', 'Guests', Users], ['invoices', 'Invoices', ReceiptText]] as const).map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${tab === id ? 'border-xt-ink bg-xt-ink text-xt-sand' : 'border-xt-line bg-white text-xt-ink'}`}><Icon className="h-4 w-4" aria-hidden />{label}</button>
        ))}
        {tab === 'guests' && <label className="relative ml-auto w-full sm:w-72"><Search className="absolute left-3 top-3.5 h-4 w-4 text-xt-mute" aria-hidden /><input aria-label="Search guests" placeholder="Name or WhatsApp number" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 w-full rounded-full border border-xt-line bg-white pl-9 pr-3 text-base" /></label>}
      </div>
      {tab === 'guests' ? (
        <Panel>
          {guests.isLoading ? <p className="text-xt-mute">Loading…</p> : g.length === 0 ? <p className="text-xt-mute">No guests yet. Guests appear here once they send a WhatsApp enquiry.</p> : (
            <ul className="divide-y divide-xt-line">{g.map((x) => (
              <li key={x.key}>
                <Link to="/admin/guest-folio/$key" params={{ key: x.key }} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 hover:bg-xt-cream/50 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem]">
                  <span className="min-w-0"><span className="block truncate font-semibold text-xt-ink">{x.name}</span><span className="text-sm text-xt-mute">{x.phone} · {x.stays} stay{x.stays === 1 ? '' : 's'} · {x.propertyIds.map((p) => PROP[p] ?? p).join(', ')}</span></span>
                  <span className="hidden text-right text-sm sm:block">Billed<br /><b>{inr(x.billed)}</b></span>
                  <span className="hidden text-right text-sm sm:block">Paid<br /><b>{inr(x.paid)}</b></span>
                  <span className={`text-right text-sm ${x.balance > 0 ? 'text-xt-crimson' : 'text-xt-pine'}`}>{x.balance > 0 ? <>Due<br /><b>{inr(x.balance)}</b></> : 'Settled'}</span>
                </Link>
              </li>))}</ul>
          )}
        </Panel>
      ) : (
        <Panel>
          {inv.isLoading ? <p className="text-xt-mute">Loading…</p> : (inv.data ?? []).length === 0 ? <p className="text-xt-mute">No invoices yet.</p> : (
            <ul className="divide-y divide-xt-line">{(inv.data ?? []).map((i) => (
              <li key={i.id}><Link to="/admin/sales-invoices/$id" params={{ id: i.id }} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 hover:bg-xt-cream/50">
                <span className="min-w-0"><span className="block font-mono font-semibold text-xt-ink">{i.number}</span><span className="text-sm text-xt-mute">{i.guestName} · {i.reference} · {PROP[i.propertyId] ?? i.propertyId} · {new Date(i.issuedAt).toLocaleDateString('en-IN')}</span></span>
                <span className="text-right text-sm"><b>{inr(i.total)}</b><br /><span className={i.balance > 0 ? 'text-xt-crimson' : 'text-xt-pine'}>{i.balance > 0 ? `Due ${inr(i.balance)}` : 'Paid'}</span></span>
              </Link></li>))}</ul>
          )}
        </Panel>
      )}
    </div>
  );
}
