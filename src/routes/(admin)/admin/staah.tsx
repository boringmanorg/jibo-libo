import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getBookingEngineStatus, getStaahLog, runStaahTest, saveStaahMapping } from '@/admin/bookingConsole.functions';
import { NotSetUp } from '@/admin/components/engineBits';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import type { ChannelMapping } from '@/booking/channel/channelManager';

export const Route = createFileRoute('/(admin)/admin/staah')({ component: Staah });

const TESTS = [
  { action: 'status', label: 'Check connection' },
  { action: 'pull', label: 'Pull rates and availability (14 days)' },
  { action: 'push_test', label: 'Send a test booking' },
] as const;

function Staah() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getBookingEngineStatus);
  const fetchLog = useServerFn(getStaahLog);
  const status = useQuery({ queryKey: ['engine', 'status'], queryFn: () => fetchStatus() });
  const log = useQuery({ queryKey: ['engine', 'staah-log'], queryFn: () => fetchLog() });
  const test = useServerFn(runStaahTest);
  const save = useServerFn(saveStaahMapping);
  const toRows = (saved: ChannelMapping[]) => BOOKING_ROOM_TYPES.map((r) => saved.find((m) => m.roomTypeId === r.id) ?? { roomTypeId: r.id, roomCode: '', rateCode: '' });
  const [rows, setRows] = useState<ChannelMapping[] | null>(() => (status.data?.dbReady ? toRows(status.data.mapping) : null));

  useEffect(() => {
    if (status.data?.dbReady && !rows) setRows(toRows(status.data.mapping));
  }, [status.data, rows]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['engine'] });
  const testM = useMutation({ mutationFn: (action: (typeof TESTS)[number]['action']) => test({ data: { action } }), onSuccess: (r) => { (r.ok ? toast.success : toast.error)(r.detail); refresh(); }, onError: (e) => toast.error(e.message) });
  const saveM = useMutation({ mutationFn: () => save({ data: { rows: rows! } }), onSuccess: () => { toast.success('Mapping saved'); refresh(); }, onError: (e) => toast.error(e.message) });

  if (status.error) return <p className="text-destructive">Could not load STAAH settings.</p>;
  if (!status.data) return <p className="text-muted-foreground">Loading…</p>;
  if (!status.data.dbReady) return <NotSetUp />;
  const connected = status.data.state.channelConnected;
  const unmapped = new Set(status.data.state.unmappedRoomTypes);

  return (
    <div className="space-y-6">
      <Card><CardHeader><CardTitle>STAAH connection</CardTitle></CardHeader><CardContent className="space-y-4">
        <Badge variant={connected ? 'default' : 'secondary'}>{connected ? 'Connected' : 'Not connected'}</Badge>
        {!connected && <p className="text-sm text-muted-foreground">STAAH enables connections through its ChannelConnect API on request. Once STAAH sends the access details for your property, they are saved as server secrets and these tests start working.</p>}
        <div className="flex flex-wrap gap-2">{TESTS.map((t) => (
          <Button key={t.action} variant="outline" className="min-h-12" disabled={testM.isPending} onClick={() => testM.mutate(t.action)}>{t.label}</Button>
        ))}</div>
        <p className="text-xs text-muted-foreground">The test booking goes to STAAH's test property, never to live OTAs.</p>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Room and rate codes</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Each room type must match one STAAH room code and one rate code. Copy them from your STAAH extranet.</p>
        {rows && <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="py-2">Room type</th><th>STAAH room code</th><th>STAAH rate code</th><th /></tr></thead>
          <tbody>{rows.map((m, i) => {
            const room = BOOKING_ROOM_TYPES.find((r) => r.id === m.roomTypeId)!;
            const set = (k: 'roomCode' | 'rateCode', v: string) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
            return (
              <tr key={m.roomTypeId} className="border-t border-border">
                <td className="py-2">{room.name}<span className="block font-mono text-xs text-muted-foreground">{room.id}</span></td>
                <td><Input aria-label={`${room.name} room code`} className="h-12 text-base" value={m.roomCode} onChange={(e) => set('roomCode', e.target.value)} /></td>
                <td><Input aria-label={`${room.name} rate code`} className="h-12 text-base" value={m.rateCode} onChange={(e) => set('rateCode', e.target.value)} /></td>
                <td>{unmapped.has(m.roomTypeId) ? <Badge variant="secondary">not mapped</Badge> : <Badge>mapped</Badge>}</td>
              </tr>
            );
          })}</tbody></table></div>}
        <Button className="min-h-12" disabled={!rows || saveM.isPending} onClick={() => saveM.mutate()}>Save codes</Button>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Sync log</CardTitle></CardHeader><CardContent>
        {!log.data?.dbReady || log.data.rows.length === 0 ? <p className="text-sm text-muted-foreground">No STAAH messages yet.</p> : (
          <ul className="divide-y divide-border text-sm">{log.data.rows.map((r: any) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{new Date(r.created_at).toLocaleString('en-IN')} · {r.direction} · {r.message_type} · {r.detail}</span>
              <Badge variant={r.status === 'ok' ? 'default' : r.status === 'pending' ? 'secondary' : 'destructive'}>{r.status}</Badge>
            </li>))}</ul>
        )}
      </CardContent></Card>
    </div>
  );
}
