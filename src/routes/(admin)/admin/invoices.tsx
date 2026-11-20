import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getBusinessFn, issueTaxInvoiceFn, listInvoicesFn, saveBusinessFn } from '@/admin/engineOps.functions';
import type { Business } from '@/admin/engineOps.core';
import { inr } from '@/admin/components/engineBits';

export const Route = createFileRoute('/(admin)/admin/invoices')({ component: Invoices });

const KIND: Record<string, string> = { advance_receipt: 'Advance receipt', tax_invoice: 'Tax invoice' };

function Invoices() {
  const qc = useQueryClient();
  const list = useServerFn(listInvoicesFn);
  const issue = useServerFn(issueTaxInvoiceFn);
  const q = useQuery({ queryKey: ['engine', 'invoices'], queryFn: () => list() });
  const m = useMutation({
    mutationFn: (bookingId: string) => issue({ data: { bookingId } }),
    onSuccess: (r) => { toast.success(`Tax invoice ${r.number} issued`); void qc.invalidateQueries({ queryKey: ['engine', 'invoices'] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <BusinessCard />

      <Card>
        <CardHeader><CardTitle className="text-lg">Ready for a tax invoice</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">Bookings that have arrived and have no tax invoice yet. Advance receipts are issued automatically when the 25% advance is paid online.</p>
          {q.isLoading && <p>Loading…</p>}
          {q.data?.pending.length === 0 && <p className="text-muted-foreground">Nothing waiting.</p>}
          <ul className="divide-y divide-border">
            {q.data?.pending.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span><span className="font-medium">{b.reference}</span> · {b.guestName} · {b.checkIn} to {b.checkOut} · {inr(b.total)}</span>
                <Button className="min-h-11" disabled={m.isPending} onClick={() => m.mutate(b.id)}>Issue tax invoice</Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Issued</CardTitle></CardHeader>
        <CardContent>
          {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
          {q.data?.invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="py-2">Number</th><th>Type</th><th>Booking</th><th>Guest</th><th className="text-right">Taxable</th><th className="text-right">GST</th><th /></tr></thead>
              <tbody className="divide-y divide-border">
                {q.data?.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 font-mono">{i.number}</td><td>{KIND[i.kind]}</td><td>{i.reference}</td><td>{i.guestName}</td>
                    <td className="text-right">{inr(i.taxable)}</td><td className="text-right">{inr(i.gst)}</td>
                    <td className="text-right"><Link to="/admin/invoices/$id" params={{ id: i.id }} className="inline-flex min-h-11 items-center rounded-md px-3 underline">View &amp; print</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BusinessCard() {
  const get = useServerFn(getBusinessFn);
  const save = useServerFn(saveBusinessFn);
  const q = useQuery({ queryKey: ['engine', 'business'], queryFn: () => get() });
  const [b, setB] = useState<Business>({ legalName: '', gstin: '', address: '', stateCode: '17', sacCode: '996311' });
  useEffect(() => { if (q.data) setB(q.data); }, [q.data]);
  const m = useMutation({ mutationFn: () => save({ data: b }), onSuccess: () => toast.success('Business details saved'), onError: (e) => toast.error(e.message) });

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Business details on invoices</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="b-name">Legal name</Label><Input id="b-name" className="h-12 text-base" value={b.legalName} placeholder="As registered for GST" onChange={(e) => setB({ ...b, legalName: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="b-gstin">GSTIN</Label><Input id="b-gstin" className="h-12 font-mono text-base uppercase" maxLength={15} value={b.gstin} onChange={(e) => setB({ ...b, gstin: e.target.value.toUpperCase() })} /></div>
        <div className="space-y-1 md:col-span-2"><Label htmlFor="b-addr">Registered address</Label><Textarea id="b-addr" className="min-h-20 text-base" value={b.address} onChange={(e) => setB({ ...b, address: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="b-state">State code</Label><Input id="b-state" className="h-12 text-base" maxLength={2} value={b.stateCode} onChange={(e) => setB({ ...b, stateCode: e.target.value })} /><p className="text-xs text-muted-foreground">Meghalaya is 17.</p></div>
        <div className="space-y-1"><Label htmlFor="b-sac">SAC code for rooms</Label><Input id="b-sac" className="h-12 text-base" maxLength={6} value={b.sacCode} onChange={(e) => setB({ ...b, sacCode: e.target.value })} /><p className="text-xs text-muted-foreground">996311 is room accommodation. Check with your CA.</p></div>
        <div className="md:col-span-2"><Button className="min-h-12" disabled={m.isPending} onClick={() => m.mutate()}>Save business details</Button></div>
      </CardContent>
    </Card>
  );
}
