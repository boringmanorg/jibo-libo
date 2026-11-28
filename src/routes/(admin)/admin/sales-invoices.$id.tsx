import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSalesInvoice } from '@/admin/sales.functions';
import { SALES_METHODS } from '@/admin/sales';
import xtsyLogo from '@/assets/xtsy-color-logo.webp';

export const Route = createFileRoute('/(admin)/admin/sales-invoices/$id')({ component: SalesInvoiceView });

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const d = (iso: string) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const nights = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000));
const method = (m: string) => SALES_METHODS.find((x) => x.id === m)?.label ?? m;

function SalesInvoiceView() {
  const { id } = Route.useParams();
  const get = useServerFn(getSalesInvoice);
  const q = useQuery({ queryKey: ['console', 'sales-invoice', id], queryFn: () => get({ data: { id } }) });
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error || !q.data) return <p className="text-destructive">{(q.error as Error)?.message ?? 'Invoice not found.'}</p>;
  const { folio: f, business: b } = q.data;
  const n = nights(f.checkIn, f.checkOut);
  const g = b.gstRegistered && f.gst ? f.gst : null;
  const row = (k: string, v: string | number) => (v === '' || v == null ? null : <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2"><dt className="text-neutral-500">{k}</dt><dd>{v}</dd></div>);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link to="/admin/guest-folio" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm">Back to Guest Folio</Link>
        <Button className="min-h-11" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" aria-hidden />Print or save as PDF</Button>
      </div>
      <article className="mx-auto max-w-3xl rounded-lg bg-white p-8 text-[13px] leading-relaxed text-neutral-900 shadow print:max-w-none print:p-0 print:shadow-none">
        <div className="-mx-8 -mt-8 mb-6 h-2 rounded-t-lg bg-xt-crimson print:mx-0 print:mt-0 print:rounded-none" aria-hidden />
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-300 pb-5">
          <div>
            <img src={xtsyLogo} alt="XTSY" width={150} height={50} className="mb-3 h-12 w-auto" />
            <p className="text-base font-bold">{b.legalName}</p>
            <p className="whitespace-pre-line">{b.address}</p>
            {g ? <p>GSTIN: <span className="font-mono">{b.gstin}</span> · State code {b.stateCode}</p> : <p>GST status: Not registered · State code {b.stateCode}</p>}
          </div>
          <div className="text-right">
            <p className="xt-display text-4xl leading-none tracking-wide text-xt-crimson">{g ? 'TAX INVOICE' : 'INVOICE'}</p>
            <p className="mt-2">No. <span className="font-mono font-semibold">{q.data.number}</span></p>
            <p>Date {d(q.data.issuedAt)}</p>
            <p className="text-neutral-500">www.xtsy.one · +91 88373 17070</p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-neutral-300 py-4 sm:grid-cols-2">
          <dl className="space-y-1"><p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-xt-crimson">Billed to</p>
            {row('Name', f.guestName)}{row('Phone', f.phone)}{row('Email', f.email)}{row('From', f.address)}{row('Guests', f.guests)}{row('Purpose', f.purpose)}
          </dl>
          <dl className="space-y-1"><p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-xt-crimson">Stay details</p>
            {row('Booking', f.reference)}{row('Dates', `${d(f.checkIn)} → ${d(f.checkOut)} (${n} night${n === 1 ? '' : 's'})`)}
            {row('Arrived', f.arrival)}{row('Check-out', f.departure)}{row('Room / bed', (f.rooms ?? []).join(', '))}
          </dl>
        </section>

        {g ? (
        <table className="mt-4 w-full">
          <thead className="border-b-2 border-neutral-900 text-left text-[11px] uppercase tracking-wider"><tr><th className="py-2">Description</th><th>SAC</th><th className="text-right">Taxable</th><th className="text-right">GST</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">Amount</th></tr></thead>
          <tbody>{g.rows.map((l: any, i: number) => <tr key={i} className="border-b border-neutral-200"><td className="py-2">{l.description}</td><td>{b.sacCode}</td><td className="text-right">{inr(l.taxable)}</td><td className="text-right">{l.rate}%</td><td className="text-right">{inr(l.cgst)}</td><td className="text-right">{inr(l.sgst)}</td><td className="text-right">{inr(l.amount)}</td></tr>)}</tbody>
          <tfoot className="font-semibold"><tr><td className="py-2" colSpan={2}>Totals</td><td className="text-right">{inr(g.taxable)}</td><td /><td className="text-right">{inr(g.cgst)}</td><td className="text-right">{inr(g.sgst)}</td><td className="text-right">{inr(g.total)}</td></tr></tfoot>
        </table>
        ) : (
        <table className="mt-4 w-full">
          <thead className="border-b-2 border-neutral-900 text-left text-[11px] uppercase tracking-wider"><tr><th className="py-2">Description</th><th>SAC</th><th className="text-right">Amount</th></tr></thead>
          <tbody>{f.lines.map((l: any, i: number) => <tr key={i} className="border-b border-neutral-200"><td className="py-2">{l.description}</td><td>{b.sacCode}</td><td className="text-right">{inr(l.amount)}</td></tr>)}</tbody>
        </table>
        )}

        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div><p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-xt-crimson">Payments received</p>
            <ul className="space-y-0.5">{f.payments.map((p: any, i: number) => <li key={i} className="flex justify-between gap-2"><span>{d(p.paidOn)} · {method(p.method)}{p.note ? ` · ${p.note}` : ''}</span><span>{inr(p.amount)}</span></li>)}</ul>
          </div>
          <dl className="space-y-1">
            <div className="flex justify-between rounded bg-neutral-900 px-3 py-2 text-base font-bold text-white print:bg-neutral-900"><dt>Invoice total</dt><dd>{inr(f.total)}</dd></div>
            <div className="flex justify-between"><dt>Paid</dt><dd>{inr(f.paid)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>{f.balance < 0 ? 'Refund due' : 'Balance due'}</dt><dd>{inr(Math.abs(f.balance))}</dd></div>
          </dl>
        </div>

        <p className="mt-8 text-center text-sm font-semibold text-neutral-800">Thank you for staying with XTSY.</p>
        <footer className="mt-3 border-t border-neutral-300 pt-3 text-[11px] text-neutral-600">
          {g ? 'Amounts include GST at the rates shown (CGST and SGST, place of supply: the property’s state).' : 'Invoice issued by a property that is not registered for GST; no GST is charged or payable.'} Check-in 11:00 AM, check-out 10:00 AM; late check-out up to 11:30 AM is subject to additional charges. The booking amount is non-refundable. This is a computer-generated document.
        </footer>
      </article>
    </div>
  );
}
