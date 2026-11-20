import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { getConsoleOverview, setIntegrationFlags, testConnection } from '@/admin/console.functions';

export const Route = createFileRoute('/(admin)/admin/settings')({ component: Settings });

function Settings() {
  const qc = useQueryClient();
  const overview = useServerFn(getConsoleOverview);
  const setFlags = useServerFn(setIntegrationFlags);
  const test = useServerFn(testConnection);
  const { data } = useQuery({ queryKey: ['console', 'overview'], queryFn: () => overview() });
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const row = (system: 'pms' | 'pos', title: string, desc: string, on: boolean) => (
    <Card key={system}><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{desc}</p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex min-h-12 items-center gap-3"><Switch checked={on} onCheckedChange={async (v) => {
          await setFlags({ data: { [`${system}_enabled`]: v } }); toast(v ? 'Switched on' : 'Switched off'); qc.invalidateQueries({ queryKey: ['console'] });
        }} />{on ? 'On' : 'Off'}</label>
        <Button variant="outline" className="min-h-12" onClick={async () => { const r = await test({ data: { system } }); r.ok ? toast.success(r.message) : toast.error(r.message); }}>Test connection</Button>
      </div>
    </CardContent></Card>
  );
  return (
    <div className="space-y-4">
      {!data.secretsConfigured && <p className="rounded-md border border-border bg-muted p-4 text-sm">The posbyxtsy.club address and access key are not saved yet. Switches can be set, but nothing is sent until both are added.</p>}
      {row('pms', 'PMS by XTSY for Hotels', 'Room inventory, rates, blocks and enquiries for XTSY Travellers Hostel and Experience by XTSY. The PMS handles channel-manager/OTA updates itself.', data.settings.pms_enabled)}
      {row('pos', 'POS by XTSY for Restaurants', 'Table slots, reservations, lunch preorders and QR ordering for TAB Bistro by XTSY.', data.settings.pos_enabled)}
    </div>
  );
}
