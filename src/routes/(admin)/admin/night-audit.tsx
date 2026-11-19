import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getEngineAuditLog, runEngineNightAudit } from '@/admin/bookingConsole.functions';
import { NotSetUp } from '@/admin/components/engineBits';
import type { AuditIssue } from '@/booking/reconcile';

export const Route = createFileRoute('/(admin)/admin/night-audit')({ component: NightAudit });

function download(issues: AuditIssue[]) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = ['severity,reference,issue,detail', ...issues.map((i) => [i.severity, i.reference, i.code, i.detail].map(esc).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `xtsy-night-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function NightAudit() {
  const run = useServerFn(runEngineNightAudit);
  const fetchLog = useServerFn(getEngineAuditLog);
  const log = useQuery({ queryKey: ['engine', 'audit-log'], queryFn: () => fetchLog() });
  const runM = useMutation({ mutationFn: () => run(), onSuccess: (r) => { if (r.dbReady) toast(r.issues.length ? `${r.issues.length} item(s) need attention` : 'Everything matches'); void log.refetch(); }, onError: (e) => toast.error(e.message) });

  if (log.data && !log.data.dbReady) return <NotSetUp />;
  const result = runM.data;

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>Night audit</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Matches every payment to its booking and lists what needs a person: money received for an unconfirmed booking, a short advance, a different payment method, a settlement not yet in the bank, a booking STAAH has not confirmed, or a balance unpaid after check-out.</p>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-12" onClick={() => runM.mutate()} disabled={runM.isPending}>{runM.isPending ? 'Running…' : 'Run night audit'}</Button>
          {result?.dbReady && result.issues.length > 0 && <Button variant="outline" className="min-h-12" onClick={() => download(result.issues)}>Download CSV</Button>}
        </div>
        {result?.dbReady && (result.issues.length === 0 ? <p className="text-sm">Everything matches as of {new Date(result.ranAt).toLocaleString('en-IN')}.</p> : (
          <ul className="divide-y divide-border text-sm">{result.issues.map((i, n) => (
            <li key={n} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <span><span className="font-mono">{i.reference}</span> · {i.detail}</span>
              <Badge variant={i.severity === 'high' ? 'destructive' : 'secondary'}>{i.severity}</Badge>
            </li>))}</ul>
        ))}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Console activity</CardTitle></CardHeader><CardContent>
        {!log.data ? <p className="text-sm text-muted-foreground">Loading…</p> : log.data.rows.length === 0 ? <p className="text-sm text-muted-foreground">No actions yet.</p> : (
          <ul className="divide-y divide-border text-sm">{log.data.rows.map((a: any) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{a.action}{a.details?.reference ? ` · ${a.details.reference}` : ''}</span>
              <span className="text-muted-foreground">{a.actor_email} · {new Date(a.created_at).toLocaleString('en-IN')}</span></li>))}</ul>
        )}
      </CardContent></Card>
    </div>
  );
}
