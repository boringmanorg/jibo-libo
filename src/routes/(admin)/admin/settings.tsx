import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { FileSpreadsheet, Hotel, UtensilsCrossed } from 'lucide-react';
import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { getConsoleOverview, setIntegrationFlags, testConnection } from '@/admin/console.functions';
import { PageHead, Panel, SheetChip } from '@/admin/components/ConsoleBits';
import { ChannelManagerPanel } from '@/admin/components/ChannelManagerPanel';

export const Route = createFileRoute('/(admin)/admin/settings')({ component: Connections });

function Row({ icon, title, status, children }: { icon: ReactNode; title: string; status: ReactNode; children: ReactNode }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-xt-sand text-xt-ink" aria-hidden>{icon}</span>
          <h2 className="text-lg font-extrabold text-xt-ink">{title}</h2>
        </div>
        {status}
      </div>
      <div className="mt-4 space-y-3 text-[15px] text-xt-mute">{children}</div>
    </Panel>
  );
}

const pill = (on: boolean, onText: string, offText: string) => (
  <span className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold ${on ? 'bg-xt-leaf/10 text-xt-pine' : 'bg-xt-cream text-xt-mute'}`}>{on ? onText : offText}</span>
);

function Connections() {
  const qc = useQueryClient();
  const overview = useServerFn(getConsoleOverview);
  const setFlags = useServerFn(setIntegrationFlags);
  const test = useServerFn(testConnection);
  const { data } = useQuery({ queryKey: ['console', 'overview'], queryFn: () => overview() });
  if (!data) return <p className="text-muted-foreground">Loading…</p>;

  const toggle = (system: 'pms' | 'pos', on: boolean) => (
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex min-h-11 items-center gap-3 font-semibold text-xt-ink"><Switch checked={on} onCheckedChange={async (v) => {
        await setFlags({ data: { [`${system}_enabled`]: v } }); toast(v ? 'Switched on' : 'Switched off'); void qc.invalidateQueries({ queryKey: ['console'] });
      }} />{on ? 'On' : 'Off'}</label>
      <button type="button" className="min-h-11 rounded-full border border-xt-line bg-white px-4 text-sm font-semibold text-xt-ink hover:border-xt-ink"
        onClick={async () => { const r = await test({ data: { system } }); r.ok ? toast.success(r.message) : toast.error(r.message); }}>Test connection</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHead title="Connections" sub="Where availability comes from today, and what can be plugged in later." />

      <Row icon={<FileSpreadsheet className="h-5 w-5" />} title="Google Sheet: Room Management" status={<SheetChip syncedAt={data.sheetSyncedAt} />}>
        <p>Your live availability. A script in the sheet sends the numbers on every saved edit. It also writes OTA and website bookings into the Room Management tab the way you do (“Name 2B MMT”, “Name 2G XTSY”), so you type only offline bookings. No other tab is touched.</p>
        <p>Setup steps are in the repository at <code className="rounded bg-xt-sand px-1.5 py-0.5 text-xt-ink">scripts/google-sheet/README.md</code>.</p>
      </Row>

      <ChannelManagerPanel />

      <Row icon={<Hotel className="h-5 w-5" />} title="PMS" status={pill(data.settings.pms_enabled && data.secretsConfigured, 'Connected', data.secretsConfigured ? 'Off' : 'Not configured')}>
        <p>The Hostel PMS by XTSY (posbyxtsy.club), when it is ready, connects here to the booking engine, which stays the only system that talks to the channel manager. That way each hotel has one source of room counts.</p>
        {!data.secretsConfigured && <p className="rounded-2xl bg-xt-sand p-3 text-sm">The PMS address and access key aren’t saved yet. The switch can be set, but nothing is sent until both are added.</p>}
        {toggle('pms', data.settings.pms_enabled)}
      </Row>

      <Row icon={<UtensilsCrossed className="h-5 w-5" />} title="POS by XTSY: TAB Bistro" status={pill(data.settings.pos_enabled && data.secretsConfigured, 'Connected', data.secretsConfigured ? 'Off' : 'Not configured')}>
        <p>Table slots, reservations, lunch preorders and QR ordering for TAB Bistro.</p>
        {toggle('pos', data.settings.pos_enabled)}
      </Row>
    </div>
  );
}
