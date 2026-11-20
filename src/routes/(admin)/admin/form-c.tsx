import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listFormCFn, saveFormCFn } from '@/admin/engineOps.functions';
import type { FormCRow } from '@/admin/engineOps.core';

export const Route = createFileRoute('/(admin)/admin/form-c')({ component: FormC });

type Filter = 'due' | 'submitted' | 'all';

function csv(rows: FormCRow[]) {
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = ['reference', 'guest', 'nationality', 'check_in', 'check_out', 'passport_number', 'passport_expiry', 'visa_number', 'visa_type', 'form_c_status', 'form_c_number'];
  const body = rows.map((r) => [r.reference, r.fullName, r.nationality, r.checkIn, r.checkOut, r.passportNumber, r.passportExpiry, r.visaNumber, r.visaType, r.status, r.formCNumber].map(esc).join(','));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' }));
  a.download = `xtsy-form-c-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function FormC() {
  const [filter, setFilter] = useState<Filter>('due');
  const list = useServerFn(listFormCFn);
  const q = useQuery({ queryKey: ['engine', 'form-c', filter], queryFn: () => list({ data: { filter } }) });
  const rows = q.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Form C</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Foreign guests from online bookings appear here. File each Form C on the{' '}
            <a className="underline" href="https://indianfrro.gov.in/frro/FormC" target="_blank" rel="noreferrer">FRRO portal</a>{' '}
            within 24 hours of arrival, then record the application number here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['due', 'submitted', 'all'] as const).map((f) => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} className="min-h-11 capitalize" onClick={() => setFilter(f)}>{f}</Button>
          ))}
          <Button variant="outline" className="min-h-11" disabled={!rows.length} onClick={() => csv(rows)}>Download CSV</Button>
        </div>
      </div>
      {q.error && <p className="rounded-md border border-destructive/40 p-3 text-sm">{(q.error as Error).message}</p>}
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!q.isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">{filter === 'due' ? 'Nothing due. Foreign guests appear here once their booking is confirmed.' : 'No records.'}</p>}
      {rows.map((r) => <FormCCard key={r.id} row={r} />)}
    </div>
  );
}

function FormCCard({ row }: { row: FormCRow }) {
  const qc = useQueryClient();
  const save = useServerFn(saveFormCFn);
  const [f, setF] = useState({ passportNumber: row.passportNumber, passportExpiry: row.passportExpiry, visaNumber: row.visaNumber, visaType: row.visaType, formCNumber: row.formCNumber });
  const m = useMutation({
    mutationFn: (submitted: boolean) => save({ data: { id: row.id, ...f, submitted } }),
    onSuccess: (_r, submitted) => { toast.success(submitted ? 'Marked submitted' : 'Saved'); void qc.invalidateQueries({ queryKey: ['engine', 'form-c'] }); },
    onError: (e) => toast.error(e.message),
  });
  const due = row.status === 'due';
  const overdue = due && row.hoursLeft < 0;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{row.fullName} <span className="font-normal text-muted-foreground">· {row.nationality}</span></p>
            <p className="text-sm text-muted-foreground">{row.reference} · {row.checkIn} to {row.checkOut}</p>
          </div>
          {due ? (
            <Badge variant={overdue ? 'destructive' : 'secondary'}>{overdue ? `Overdue by ${Math.abs(row.hoursLeft)} h` : row.hoursLeft > 48 ? `Due after arrival on ${row.checkIn}` : `${row.hoursLeft} h left`}</Badge>
          ) : (
            <Badge>Submitted {row.formCNumber && `· ${row.formCNumber}`}</Badge>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field id={`pp-${row.id}`} label="Passport number" value={f.passportNumber} onChange={(v) => setF({ ...f, passportNumber: v })} />
          <Field id={`pe-${row.id}`} label="Passport expiry" type="date" value={f.passportExpiry} onChange={(v) => setF({ ...f, passportExpiry: v })} />
          <Field id={`vn-${row.id}`} label="Visa number" value={f.visaNumber} onChange={(v) => setF({ ...f, visaNumber: v })} />
          <Field id={`vt-${row.id}`} label="Visa type" value={f.visaType} onChange={(v) => setF({ ...f, visaType: v })} />
          <Field id={`fc-${row.id}`} label="Form C application no." value={f.formCNumber} onChange={(v) => setF({ ...f, formCNumber: v })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11" disabled={m.isPending} onClick={() => m.mutate(false)}>{due ? 'Save details' : 'Mark as due again'}</Button>
          {due && <Button className="min-h-11" disabled={m.isPending} onClick={() => m.mutate(true)}>Mark Form C submitted</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} className="h-11 text-base" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </div>
  );
}
