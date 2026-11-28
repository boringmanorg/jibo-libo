import { buildRouteHead } from '@/lib/seo-head';
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
import { useConsoleProperty } from '@/admin/consoleScope';
import { getBusinessFn, issueTaxInvoiceFn, listInvoicesFn, saveBusinessFn } from '@/admin/engineOps.functions';
import type { Business } from '@/admin/engineOps.core';
import { inr } from '@/admin/components/engineBits';

export const Route = createFileRoute('/(admin)/admin/invoices')({ head: () => buildRouteHead({ path: '/admin/invoices', title: 'Invoices — XTSY Console', description: 'Property-scoped XTSY business invoices and tax details.', noIndex: true }), component: Invoices });

const KIND: Record<string, string> = { advance_receipt: 'Advance receipt', tax_invoice: 'Tax invoice', business_invoice: 'Business invoice' };

function Invoices() {
  const qc = useQueryClient();
  const propertyId = useConsoleProperty() ?? 'XTSY-SHL-HOSTEL';
  const list = useServerFn(listInvoicesFn);
  const issue = useServerFn(issueTaxInvoiceFn);
  const q = useQuery({ queryKey: ['engine', 'invoices', propertyId], queryFn: () => list({ data: { propertyId } }) });
  const m = useMutation({
    mutationFn: (bookingId: string) => issue({ data: { bookingId, propertyId } }),
    onSuccess: (r) => { toast.success(`Invoice ${r.number} issued`); void qc.invalidateQueries({ queryKey: ['engine', 'invoices'] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <BusinessCard propertyId={propertyId} />

      <Card>
        <CardHeader><CardTitle className="text-lg">Ready for a business or tax invoice</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">Bookings that have arrived and have no tax invoice yet. Advance receipts are issued automatically when the 25% advance is paid online.</p>
          {q.isLoading && <p>Loading…</p>}
          {q.data?.pending.length === 0 && <p className="text-muted-foreground">Nothing waiting.</p>}
          <ul className="divide-y divide-border">
            {q.data?.pending.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span><span className="font-medium">{b.reference}</span> · {b.guestName} · {b.checkIn} to {b.checkOut} · {inr(b.total)}</span>
                <Button className="min-h-[48px]" disabled={m.isPending} onClick={() => m.mutate(b.id)}>Issue invoice</Button>
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
                    <td className="text-right"><Link to="/admin/invoices/$id" params={{ id: i.id }} search={{ property: propertyId }} className="inline-flex min-h-11 items-center rounded-md px-3 underline">View &amp; print</Link></td>
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

function BusinessCard({ propertyId }: { propertyId: Business['propertyId'] }) {
  const get = useServerFn(getBusinessFn);
  const save = useServerFn(saveBusinessFn);
  const q = useQuery({ queryKey: ['engine', 'business', propertyId], queryFn: () => get({ data: { propertyId } }) });
  const [b, setB] = useState<Business>({ propertyId, gstRegistered: false, legalName: '', gstin: '', address: '', stateCode: '17', sacCode: '996311' });
  useEffect(() => { if (q.data) setB(q.data); }, [q.data]);
  const m = useMutation({ mutationFn: () => save({ data: b }), onSuccess: () => toast.success('Property invoice details saved'), onError: (e) => toast.error(e.message) });

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Property and GST status on invoices</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2"><Label htmlFor="b-property">Property</Label><p id="b-property" className="py-3 font-semibold">{propertyId === 'XTSY-SHN-CAMP' ? 'Shnonpedeng Riverside Camping by XTSY' : 'XTSY Travellers Hostel'}</p><p className="text-xs text-muted-foreground">Each company or franchise-held property keeps its own GST registration and GSTIN. Never copy one property’s tax identity to another.</p></div>
        <label className="flex min-h-[48px] items-center gap-3 rounded-xl bg-muted p-3 font-medium md:col-span-2"><input type="checkbox" className="h-6 w-6" checked={b.gstRegistered} onChange={(e) => setB({ ...b, gstRegistered: e.target.checked })} /><span>This property is registered for GST</span><span className="text-sm text-muted-foreground">{b.gstRegistered ? 'Issues tax invoices with GST.' : 'Issues ordinary business invoices with no GST.'}</span></label>
        <div className="space-y-1"><Label htmlFor="b-name">Legal or business name</Label><Input id="b-name" className="min-h-[48px] text-base" value={b.legalName} onChange={(e) => setB({ ...b, legalName: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="b-gstin">GSTIN {b.gstRegistered ? '' : '(not shown while unregistered)'}</Label><Input id="b-gstin" disabled={!b.gstRegistered} className="min-h-[48px] font-mono text-base uppercase" maxLength={15} value={b.gstin} onChange={(e) => setB({ ...b, gstin: e.target.value.toUpperCase() })} /></div>
        <div className="space-y-1 md:col-span-2"><Label htmlFor="b-addr">Business address</Label><Textarea id="b-addr" className="min-h-20 text-base" value={b.address} onChange={(e) => setB({ ...b, address: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="b-state">State code</Label><Input id="b-state" className="min-h-[48px] text-base" maxLength={2} value={b.stateCode} onChange={(e) => setB({ ...b, stateCode: e.target.value })} /><p className="text-xs text-muted-foreground">Meghalaya is 17.</p></div>
        <div className="space-y-1"><Label htmlFor="b-sac">SAC code for rooms</Label><Input id="b-sac" className="min-h-[48px] text-base" maxLength={6} value={b.sacCode} onChange={(e) => setB({ ...b, sacCode: e.target.value })} /><p className="text-xs text-muted-foreground">996311 is room accommodation. Check with your CA.</p></div>
        <div className="md:col-span-2"><Button className="min-h-[48px]" disabled={m.isPending} onClick={() => m.mutate()}>Save property invoice details</Button></div>
      </CardContent>
    </Card>
  );
}
