import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { deleteSalesPayment, getSalesFolio, issueSalesInvoice, recordSalesPayment } from '@/admin/sales.functions';
import { SALES_METHODS, folioTotals, type FolioLine, type SalesMethod } from '@/admin/sales';

const todayIso = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const input = 'h-11 min-w-0 rounded-xl border border-xt-line bg-white px-3 text-base';

/** Payments and invoice for one confirmed enquiry. */
export function SalesFolio({ e }: { e: { id: string; summary: string; estimate_rupees: number; check_in: string; check_out: string } }) {
  const qc = useQueryClient();
  const get = useServerFn(getSalesFolio);
  const key = ['console', 'sales-folio', e.id];
  const q = useQuery({ queryKey: key, queryFn: () => get({ data: { enquiryId: e.id } }) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['console'] });
  const fail = (err: unknown) => toast.error((err as Error).message);
  const record = useServerFn(recordSalesPayment);
  const remove = useServerFn(deleteSalesPayment);
  const issue = useServerFn(issueSalesInvoice);
  const [pay, setPay] = useState({ amount: '', method: 'upi' as SalesMethod, paidOn: todayIso(), note: '' });
  const first = String(e.summary).split(' | ')[0] ?? 'Accommodation';
  const [lines, setLines] = useState<FolioLine[]>([{ description: `${first}, ${e.check_in} to ${e.check_out}`, amount: Number(e.estimate_rupees) || 0 }]);
  const payM = useMutation({ mutationFn: () => record({ data: { enquiryId: e.id, amount: Number(pay.amount), method: pay.method, paidOn: pay.paidOn, note: pay.note || undefined } }), onSuccess: () => { toast.success('Payment recorded'); setPay({ ...pay, amount: '', note: '' }); refresh(); }, onError: fail });
  const delM = useMutation({ mutationFn: (id: string) => remove({ data: { id, enquiryId: e.id } }), onSuccess: () => { toast.success('Payment removed'); refresh(); }, onError: fail });
  const invM = useMutation({ mutationFn: () => issue({ data: { enquiryId: e.id, lines } }), onSuccess: (r) => { toast.success(`Invoice ${r.number} issued`); refresh(); }, onError: fail });
  if (!q.data) return <p className="text-sm text-xt-mute">Loading payments…</p>;
  const t = folioTotals(lines, q.data.payments);
  const invoiced = q.data.invoice;
  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-xt-line bg-xt-cream/40 p-4">
      <div>
        <p className="text-sm font-bold text-xt-ink">Payments</p>
        {q.data.payments.length === 0 ? <p className="text-sm text-xt-mute">No payments recorded yet.</p> : (
          <ul className="mt-1 divide-y divide-xt-line text-sm">{q.data.payments.map((p) => (
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-1.5">
              <span className="min-w-0 truncate">{p.paidOn} · {SALES_METHODS.find((m) => m.id === p.method)?.label}{p.note ? ` · ${p.note}` : ''}</span>
              <span className="flex items-center gap-2 font-semibold">{inr(p.amount)}{!invoiced && <button type="button" aria-label="Remove payment" disabled={delM.isPending} onClick={() => delM.mutate(p.id)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white"><Trash2 className="h-4 w-4" /></button>}</span>
            </li>))}</ul>
        )}
        {!invoiced && <div className="mt-2 grid gap-2 sm:grid-cols-[7rem_8rem_10rem_minmax(0,1fr)_auto]">
          <input className={input} type="number" min={1} inputMode="decimal" placeholder="₹ amount" aria-label="Amount paid" value={pay.amount} onChange={(ev) => setPay({ ...pay, amount: ev.target.value })} />
          <select className={input} aria-label="Payment method" value={pay.method} onChange={(ev) => setPay({ ...pay, method: ev.target.value as SalesMethod })}>{SALES_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
          <input className={input} type="date" max={todayIso()} aria-label="Paid on" value={pay.paidOn} onChange={(ev) => setPay({ ...pay, paidOn: ev.target.value })} />
          <input className={input} placeholder="UPI ref / note" aria-label="Payment note" value={pay.note} onChange={(ev) => setPay({ ...pay, note: ev.target.value })} />
          <button type="button" disabled={payM.isPending || !(Number(pay.amount) > 0)} onClick={() => payM.mutate()} className="min-h-11 rounded-full bg-xt-ink px-4 text-sm font-bold text-xt-sand disabled:opacity-40">Record payment</button>
        </div>}
      </div>

      {invoiced ? (
        <Link to="/admin/sales-invoices/$id" params={{ id: invoiced.id }} className="inline-flex min-h-11 items-center rounded-full bg-xt-crimson px-5 text-sm font-bold text-white">Open invoice {invoiced.number}</Link>
      ) : q.data.payments.length > 0 && (
        <div>
          <p className="text-sm font-bold text-xt-ink">Invoice lines</p>
          <p className="text-xs text-xt-mute">Pre-filled from the enquiry quote. Add late check-out, meals or other charges before issuing; an issued invoice cannot be changed.</p>
          <ul className="mt-2 space-y-2">{lines.map((l, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2">
              <input className={input} aria-label="Line description" value={l.description} onChange={(ev) => setLines(lines.map((x, j) => (j === i ? { ...x, description: ev.target.value } : x)))} />
              <input className={input} type="number" inputMode="decimal" aria-label="Line amount" value={l.amount || ''} onChange={(ev) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: Number(ev.target.value) } : x)))} />
              <button type="button" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
            </li>))}</ul>
          <button type="button" onClick={() => setLines([...lines, { description: '', amount: 0 }])} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-xt-crimson"><Plus className="h-4 w-4" />Add line</button>
          <p className="mt-2 text-sm">Total {inr(t.total)} · Paid {inr(t.paid)} · <span className="font-semibold">Balance {inr(t.balance)}</span></p>
          <button type="button" disabled={invM.isPending} onClick={() => invM.mutate()} className="mt-2 min-h-12 rounded-full bg-xt-crimson px-6 font-bold text-white disabled:opacity-40">Generate invoice</button>
        </div>
      )}
    </div>
  );
}
