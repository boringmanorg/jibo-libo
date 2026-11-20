import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getInvoiceDocFn } from '@/admin/engineOps.functions';
import { inr } from '@/admin/components/engineBits';

export const Route = createFileRoute('/(admin)/admin/invoices/$id')({ component: InvoiceView });

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const d = (iso: string) => dateFmt.format(new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso));
const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 1 : 0)}%`;

function InvoiceView() {
  const { id } = Route.useParams();
  const get = useServerFn(getInvoiceDocFn);
  const q = useQuery({ queryKey: ['engine', 'invoice', id], queryFn: () => get({ data: { id } }) });
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error || !q.data) return <p className="text-destructive">{(q.error as Error)?.message ?? 'Invoice not found.'}</p>;
  const doc = q.data;
  const title = doc.kind === 'tax_invoice' ? 'Tax invoice' : 'Receipt voucher (advance)';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link to="/admin/invoices" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm">Back to invoices</Link>
        <Button className="min-h-11" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" aria-hidden />Print or save as PDF</Button>
      </div>

      <article className="mx-auto max-w-3xl rounded-lg bg-white p-8 text-[13px] leading-relaxed text-neutral-900 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-300 pb-4">
          <div>
            <p className="text-lg font-bold">{doc.business.legalName || 'Legal name not set'}</p>
            <p className="whitespace-pre-line">{doc.business.address}</p>
            <p>GSTIN: <span className="font-mono">{doc.business.gstin || '—'}</span> · State code {doc.business.stateCode}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{title}</p>
            <p>No. <span className="font-mono">{doc.number}</span></p>
            <p>Date {d(doc.issuedAt)}</p>
          </div>
        </header>

        <section className="grid gap-4 border-b border-neutral-300 py-4 sm:grid-cols-2">
          <div>
            <p className="font-semibold">Billed to</p>
            <p>{doc.booking.guestName}</p>
            {doc.booking.guestEmail && <p>{doc.booking.guestEmail}</p>}
            <p>{doc.booking.guestPhone}</p>
          </div>
          <div className="sm:text-right">
            <p className="font-semibold">Stay</p>
            <p>Booking {doc.booking.reference}</p>
            <p>{d(doc.booking.checkIn)} to {d(doc.booking.checkOut)}, {doc.booking.nights} night{doc.booking.nights === 1 ? '' : 's'}</p>
            <p>Place of supply: Meghalaya ({doc.business.stateCode})</p>
          </div>
        </section>

        <table className="mt-4 w-full">
          <thead className="border-b border-neutral-300 text-left">
            <tr><th className="py-2">Description</th><th>SAC</th><th className="text-right">Taxable value</th><th className="text-right">GST</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.description} className="border-b border-neutral-200">
                <td className="py-2">{l.description}</td><td>{l.sac}</td>
                <td className="text-right">{inr(l.taxable)}</td>
                <td className="text-right">{inr(l.gst)} <span className="text-neutral-500">({pct(l.gstBps)})</span></td>
                <td className="text-right">{inr(l.taxable + l.gst)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1">
          <div className="flex justify-between"><dt>Taxable value</dt><dd>{inr(doc.taxable)}</dd></div>
          <div className="flex justify-between"><dt>CGST</dt><dd>{inr(doc.cgst)}</dd></div>
          <div className="flex justify-between"><dt>SGST</dt><dd>{inr(doc.sgst)}</dd></div>
          <div className="flex justify-between border-t border-neutral-300 pt-1 text-base font-bold"><dt>{doc.kind === 'tax_invoice' ? 'Invoice total' : 'Amount received'}</dt><dd>{inr(doc.total)}</dd></div>
          {doc.kind === 'tax_invoice' && (
            <>
              <div className="flex justify-between text-neutral-600"><dt>Paid online</dt><dd>{inr(doc.paid)}</dd></div>
              <div className="flex justify-between text-neutral-600"><dt>Balance</dt><dd>{inr(doc.balance)}</dd></div>
            </>
          )}
        </dl>

        <footer className="mt-8 border-t border-neutral-300 pt-3 text-[11px] text-neutral-600">
          {doc.kind === 'advance_receipt'
            ? 'Advance received against the booking above. The tax invoice is issued for the full stay.'
            : 'GST on accommodation is charged at the rate for the room tariff. Payment gateway charges, where paid, are billed by the payment provider.'}
          {' '}This is a computer-generated document.
        </footer>
      </article>
    </div>
  );
}
