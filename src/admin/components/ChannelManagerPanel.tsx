/**
 * Connections → Channel manager (ZimmerStack). One card per XTSY property, each with its own switch.
 * Every button is one admin action; the answer (including anything ZimmerStack did not do) is shown
 * right under the property it was for.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Network } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  addChannelHotel, getChannelOverview, linkChannelHotel, makeOtaConnectLink, runChannelAction, setChannelProperty, testChannelConnection,
} from '@/admin/channel.functions';
import { Panel, ago } from './ConsoleBits';

const WEBHOOK_URL = 'https://xtsy.one/api/public/hooks/zimmerstack';
const OTAS = [
  ['bookingcom', 'Booking.com'], ['gommt', 'MakeMyTrip / Goibibo'], ['agoda', 'Agoda'], ['expedia', 'Expedia'],
  ['hostelworld', 'Hostelworld'], ['airbnb', 'Airbnb'], ['tripcom', 'Trip.com'], ['yatra', 'Yatra'],
] as const;

type Overview = Awaited<ReturnType<typeof getChannelOverview>>;
type Prop = Overview['properties'][number];
type Report = { tone: 'ok' | 'warn' | 'error'; lines: string[] };

const btn = 'min-h-11 rounded-full border border-xt-line bg-white px-4 text-sm font-semibold text-xt-ink hover:border-xt-ink disabled:opacity-40';
const pill = (tone: 'on' | 'off' | 'warn', text: string) => (
  <span className={cn('inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold',
    tone === 'on' ? 'bg-xt-leaf/10 text-xt-pine' : tone === 'warn' ? 'bg-amber-100 text-amber-900' : 'bg-xt-cream text-xt-mute')}>{text}</span>
);

/** Turns any action's answer into short lines for the admin. */
function toReport(r: any): Report {
  if (!r?.ok) return { tone: 'error', lines: [r?.message ?? 'Something went wrong.'] };
  const x = r.result ?? {};
  const lines: string[] = [];
  let tone: Report['tone'] = 'ok';
  switch (x.kind) {
    case 'catalog':
      lines.push(`Room types sent; ${x.mapped} linked to their rate plans.`);
      if (x.missingPlans?.length) { tone = 'warn'; lines.push(`No rate plan yet for: ${x.missingPlans.join(', ')}.`); }
      if (x.channelManager && !x.channelManager.enabled) { tone = 'warn'; lines.push(x.channelManager.reason ?? 'The hotel is not on the channel manager yet.'); }
      break;
    case 'write':
      lines.push(`${x.accepted} night(s) of prices accepted, ${x.unchanged} already held.`);
      break;
    case 'counts':
      lines.push(x.skipped ? x.skipped : x.error ? x.error : `${x.sent} night(s) of room counts sent${x.sent ? '' : ' (nothing had changed)'}.`);
      if (x.skipped || x.error) tone = 'warn';
      break;
    case 'readiness':
      lines.push(x.live ? 'XTSY is this hotel’s source of truth (live).' : x.ready ? 'Ready to go live.' : 'Not ready to go live yet:');
      for (const c of x.checks ?? []) if (!c.passed) { tone = 'warn'; lines.push(`${c.summary}${c.action ? ` ${c.action}` : ''}`); }
      break;
    case 'go_live':
      lines.push('Live: XTSY’s counts and prices now go to the OTAs.');
      if (x.counts?.sent !== undefined) lines.push(`${x.counts.sent} night(s) of room counts sent.`);
      break;
    case 'catch_up':
      lines.push(x.error ? x.error : `${x.applied} OTA booking update(s) read.`);
      if (x.error) tone = 'warn';
      break;
    default:
      if (x.zsPropertyId) lines.push(`Added to ZimmerStack as hotel ${x.zsPropertyId}. ${x.billing ?? ''}`);
      else if (x.live !== undefined) lines.push(x.live ? 'Linked; the hotel is live.' : 'Linked. Check readiness, then go live.');
      else if (x.on !== undefined) lines.push(x.on ? 'Switched on.' : 'Switched off. Nothing is sent for this property.');
  }
  for (const k of ['rejected', 'warnings', 'rounded', 'notices'] as const) {
    for (const item of x[k] ?? []) {
      tone = tone === 'ok' ? 'warn' : tone;
      lines.push(typeof item === 'string' ? item : `${item.message}${item.action ? ` ${item.action}` : ''}`);
    }
  }
  return { tone, lines };
}

export function ChannelManagerPanel() {
  const qc = useQueryClient();
  const overview = useServerFn(getChannelOverview);
  const test = useServerFn(testChannelConnection);
  const { data } = useQuery({ queryKey: ['console', 'channel'], queryFn: () => overview() });
  const status = !data ? pill('off', 'Loading…')
    : !data.keyMode ? pill('off', 'Key not saved')
    : data.keyMode === 'test' ? pill('warn', 'Sandbox key')
    : pill('on', 'Live key');

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-xt-sand text-xt-ink" aria-hidden><Network className="h-5 w-5" /></span>
          <h2 className="text-lg font-extrabold text-xt-ink">Channel manager: ZimmerStack</h2>
        </div>
        {status}
      </div>
      <div className="mt-4 space-y-3 text-[15px] text-xt-mute">
        <p>XTSY’s booking engine sends room counts and prices to ZimmerStack, which passes them to the OTAs; OTA bookings come back here and hold their rooms on /book at once. Your Google Sheet stays the master: only nights you change in the sheet or with a console block are sent. Each property has its own switch, and nothing is sent for a property that is off.</p>
        {data && !data.keyMode && (
          <p className="rounded-2xl bg-xt-sand p-3 text-sm text-xt-ink">Add the key in Lovable Cloud → Secrets as <code>ZIMMERSTACK_CONNECT_KEY</code>. Start with the free sandbox key (<code>zsk_test_…</code>) from the ZimmerStack partner portal → Developers → Create company key, with “Also add and remove hotels” ticked.</p>
        )}
        {data && data.keyMode && !data.webhookSecretSet && (
          <p className="rounded-2xl bg-xt-sand p-3 text-sm text-xt-ink">So OTA bookings arrive instantly: in the partner portal add a webhook endpoint <code className="break-all">{WEBHOOK_URL}</code> for the channel booking and sync events, then save its signing secret in Lovable Cloud → Secrets as <code>ZIMMERSTACK_WEBHOOK_SECRET</code>.</p>
        )}
        {data && data.keyMode && data.webhookSecretSet && <p className="text-sm">Webhook: <code className="break-all">{WEBHOOK_URL}</code> (secret saved).</p>}
        {data?.keyMode && (
          <button type="button" className={btn} onClick={async () => { const r = await test(); r.ok ? toast.success(r.message) : toast.error(r.message); }}>Test connection</button>
        )}
        {data && !data.dbReady && <p className="text-sm">The channel tables are created by this update’s database change (0030).</p>}
      </div>
      {data?.dbReady && (
        <ul className="mt-5 space-y-4">
          {data.properties.map((p) => <PropertyCard key={p.id} p={p} keyMode={data.keyMode} onChange={() => qc.invalidateQueries({ queryKey: ['console', 'channel'] })} />)}
        </ul>
      )}
    </Panel>
  );
}

function PropertyCard({ p, keyMode, onChange }: { p: Prop; keyMode: 'test' | 'live' | null; onChange: () => void }) {
  const setProp = useServerFn(setChannelProperty);
  const add = useServerFn(addChannelHotel);
  const link = useServerFn(linkChannelHotel);
  const act = useServerFn(runChannelAction);
  const otaLink = useServerFn(makeOtaConnectLink);
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [owner, setOwner] = useState({ name: 'XTSY Ventures Private Limited', email: 'admin@xtsy.one', phone: '+91 88373 17070' });
  const [existingId, setExistingId] = useState('');
  const [ota, setOta] = useState<(typeof OTAS)[number][0]>('bookingcom');
  const [connectUrl, setConnectUrl] = useState<{ url: string | null; hotelStep: string | null } | null>(null);

  const go = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    try {
      const r = await fn();
      setReport(toReport(r));
      onChange();
      return r;
    } catch (e) {
      setReport({ tone: 'error', lines: [e instanceof Error ? e.message : 'Something went wrong.'] });
    } finally {
      setBusy(null);
    }
  };
  const action = (a: 'catalog' | 'prices' | 'counts' | 'readiness' | 'go_live' | 'catch_up') => go(a, () => act({ data: { id: p.id, action: a } }));

  const line = !p.enabled ? 'Off: nothing is sent for this property.'
    : !keyMode ? 'On, waiting for the ZimmerStack key.'
    : !p.linked ? (p.otherModeLinked ? 'On. Linked with the other key type; link or add it for this key.' : 'On, not linked to a ZimmerStack hotel yet.')
    : `Hotel ${p.zsPropertyId} · ${p.live ? 'live' : 'not live yet'} · ${p.mapped} of ${p.roomTypes} room types linked · ${p.upcomingOtaBookings} upcoming OTA booking${p.upcomingOtaBookings === 1 ? '' : 's'}${p.lastEventAt ? ` · last read ${ago(p.lastEventAt)}` : ''}`;

  return (
    <li className="rounded-[24px] border border-xt-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-extrabold text-xt-ink">{p.name}</p>
          <p className="text-sm text-xt-mute">{line}</p>
        </div>
        <label className="flex min-h-11 items-center gap-3 font-semibold text-xt-ink">
          <Switch checked={p.enabled} disabled={busy !== null} aria-label={`Channel manager for ${p.name}`}
            onCheckedChange={(v) => go('switch', () => setProp({ data: { id: p.id, on: v } }))} />{p.enabled ? 'On' : 'Off'}
        </label>
      </div>

      {p.enabled && keyMode && !p.linked && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <form className="space-y-2 rounded-2xl bg-xt-sand p-4" onSubmit={(e) => { e.preventDefault(); void go('add', () => add({ data: { id: p.id, owner } })); }}>
            <p className="font-bold text-xt-ink">Add to ZimmerStack</p>
            <p className="text-sm text-xt-mute">Creates the hotel with its room types and room-only prices. {keyMode === 'live' ? 'ZimmerStack bills it monthly from the next 1st.' : 'Sandbox: nothing reaches an OTA and nothing is billed.'} The owner gets ZimmerStack’s sign-in by email.</p>
            {(['name', 'email', 'phone'] as const).map((k) => (
              <label key={k} className="block text-sm font-semibold capitalize text-xt-ink">Owner {k}
                <input value={owner[k]} onChange={(e) => setOwner({ ...owner, [k]: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-xt-line bg-white px-3 text-base font-normal" />
              </label>
            ))}
            <button type="submit" disabled={busy !== null} className="min-h-11 rounded-full bg-xt-ink px-5 text-sm font-bold text-xt-sand disabled:opacity-40">{busy === 'add' ? 'Adding…' : `Add ${p.name}`}</button>
          </form>
          <form className="space-y-2 rounded-2xl border border-xt-line p-4" onSubmit={(e) => { e.preventDefault(); void go('link', () => link({ data: { id: p.id, zsPropertyId: Number(existingId) } })); }}>
            <p className="font-bold text-xt-ink">Or link a hotel already in ZimmerStack</p>
            <label className="block text-sm font-semibold text-xt-ink">ZimmerStack hotel id
              <input inputMode="numeric" value={existingId} onChange={(e) => setExistingId(e.target.value.replace(/\D/g, ''))} className="mt-1 h-11 w-full rounded-xl border border-xt-line px-3 text-base font-normal" />
            </label>
            <button type="submit" disabled={busy !== null || !existingId} className={btn}>Link hotel</button>
          </form>
        </div>
      )}

      {p.enabled && p.linked && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={busy !== null} onClick={() => action('catalog')}>{busy === 'catalog' ? 'Sending…' : 'Send room types'}</button>
            <button type="button" className={btn} disabled={busy !== null} onClick={() => action('prices')}>{busy === 'prices' ? 'Sending…' : 'Send prices (next 365 nights)'}</button>
            <button type="button" className={btn} disabled={busy !== null || !p.live} onClick={() => action('counts')}>{busy === 'counts' ? 'Sending…' : 'Send room counts'}</button>
            <button type="button" className={btn} disabled={busy !== null} onClick={() => action('readiness')}>Check readiness</button>
            {!p.live && <button type="button" disabled={busy !== null} onClick={() => { if (confirm(`Make XTSY the source of truth for ${p.name}? From then on XTSY’s counts and prices go to every connected OTA.`)) void action('go_live'); }} className="min-h-11 rounded-full bg-xt-crimson px-5 text-sm font-bold text-white disabled:opacity-40">Go live</button>}
            <button type="button" className={btn} disabled={busy !== null} onClick={() => action('catch_up')}>Read OTA bookings now</button>
          </div>
          <p className="text-xs text-xt-mute">“Send room counts” sends only nights whose count changed since last sent. Prices are the website’s rates before GST until room and pricing control (Stage 2).</p>
          {keyMode === 'live' && (
            <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-xt-sand p-3">
              <label className="text-sm font-semibold text-xt-ink">Connect an OTA
                <select value={ota} onChange={(e) => setOta(e.target.value as typeof ota)} className="mt-1 block h-11 rounded-xl border border-xt-line bg-white px-3 text-base">
                  {OTAS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </label>
              <button type="button" className={btn} disabled={busy !== null} onClick={async () => {
                const r = await go('ota', () => otaLink({ data: { id: p.id, channel: ota } }));
                if (r?.ok) setConnectUrl(r.result);
              }}>Make a connect link</button>
              {connectUrl && (
                <div className="w-full text-sm text-xt-ink">
                  {connectUrl.hotelStep && <p className="mb-1">First, at the OTA: {connectUrl.hotelStep}</p>}
                  {connectUrl.url && <p>Then open (one-time, 72 h): <a href={connectUrl.url} target="_blank" rel="noreferrer" className="break-all font-semibold text-xt-crimson underline">{connectUrl.url}</a></p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {report && (
        <div role="status" className={cn('mt-4 rounded-2xl p-3 text-sm', report.tone === 'ok' ? 'bg-xt-leaf/10 text-xt-pine' : report.tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800')}>
          {report.lines.map((l, i) => <p key={i} className="m-0">{l}</p>)}
        </div>
      )}
    </li>
  );
}
