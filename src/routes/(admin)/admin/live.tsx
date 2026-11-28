import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useCallback, useState } from 'react';
import { Activity, Eye, BedDouble, ClipboardList, MessageCircle, LogOut } from 'lucide-react';
import { getLiveInsights } from '@/admin/live.functions';
import { useLiveDoorbell } from '@/admin/useLiveDoorbell';
import { ACTIVE_MINUTES, DROP_MINUTES } from '@/admin/liveInsights';
import { PageHead, Panel } from '@/admin/components/ConsoleBits';
import { useConsoleProperty } from '@/admin/consoleScope';
import { buildRouteHead } from '@/lib/seo-head';

export const Route = createFileRoute('/(admin)/admin/live')({
  head: () => buildRouteHead({ path: '/admin/live', title: 'Live insights — XTSY Console', description: 'Private live booking-page activity per property.', noIndex: true }),
  component: LiveInsights,
});

const indiaDay = (offset = 0) => new Date(Date.now() + 5.5 * 3600_000 - offset * 86_400_000).toISOString().slice(0, 10);
const RANGES = [['Today', 0], ['Last 7 days', 6], ['Last 30 days', 29]] as const;

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Eye; label: string; value: number; tone?: 'live' | 'warn' | 'ok' }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === 'live' ? 'border-xt-leaf/30 bg-xt-leaf/5' : tone === 'warn' ? 'border-amber-200 bg-amber-50' : tone === 'ok' ? 'border-xt-pine/20 bg-white' : 'border-xt-line bg-white'}`}>
      <p className="flex items-center gap-2 text-sm text-xt-mute"><Icon className="h-4 w-4" aria-hidden />{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-xt-ink tabular-nums">{value}</p>
    </div>
  );
}

function LiveInsights() {
  const qc = useQueryClient();
  const get = useServerFn(getLiveInsights);
  const selected = useConsoleProperty();
  const [days, setDays] = useState<number>(0);
  const since = indiaDay(days);
  const key = ['console', 'live', since];
  const q = useQuery({ queryKey: key, queryFn: () => get({ data: { since } }) });
  const refresh = useCallback(() => void qc.invalidateQueries({ queryKey: ['console', 'live'] }), [qc]);
  useLiveDoorbell(refresh);
  const list = (q.data?.properties ?? []).filter((p) => !selected || p.propertyId === selected);

  return (
    <div className="space-y-4">
      <PageHead title="Live insights" sub={`Who is on /book right now, and how far each visit got. Updates by itself as guests move. "Now" means active in the last ${ACTIVE_MINUTES} minutes.`} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Period">
        {RANGES.map(([label, d]) => (
          <button key={label} type="button" onClick={() => setDays(d)} aria-pressed={days === d} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${days === d ? 'border-xt-ink bg-xt-ink text-xt-sand' : 'border-xt-line bg-white text-xt-ink'}`}>{label}</button>
        ))}
      </div>
      {q.isLoading && <p className="text-xt-mute">Loading…</p>}
      {q.error && <p className="text-destructive">{(q.error as Error).message}</p>}
      {q.data?.truncated && <p className="text-sm text-amber-800">Showing the most recent 10,000 steps for this period.</p>}
      {list.map((p) => (
        <Panel key={p.propertyId}>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-xt-ink"><Activity className="h-5 w-5 text-xt-leaf" aria-hidden />{p.name}</h2>
          <p className="mt-3 text-sm font-semibold text-xt-ink">Right now</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <Stat icon={Eye} label="Viewing the page" value={p.now.viewing} tone="live" />
            <Stat icon={BedDouble} label="Choosing rooms" value={p.now.rooms} tone="live" />
            <Stat icon={ClipboardList} label="Filling guest details" value={p.now.details} tone="live" />
          </div>
          <p className="mt-5 text-sm font-semibold text-xt-ink">This period</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-5">
            <Stat icon={Eye} label="Visits" value={p.period.visits} />
            <Stat icon={BedDouble} label="Chose rooms" value={p.period.rooms} />
            <Stat icon={ClipboardList} label="Reached guest details" value={p.period.details} />
            <Stat icon={LogOut} label={`Dropped (quiet ${DROP_MINUTES} min)`} value={p.period.dropped} tone="warn" />
            <Stat icon={MessageCircle} label="Contacted on WhatsApp" value={p.period.contacted} tone="ok" />
          </div>
          {p.contacts.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-xt-ink">Contacted: check against your WhatsApp chats</p>
              <ul className="mt-2 divide-y divide-xt-line rounded-2xl border border-xt-line bg-white">
                {p.contacts.map((c) => (
                  <li key={c.reference} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 py-3 text-sm">
                    <span className="min-w-0"><span className="font-semibold text-xt-ink">{c.name || 'Name not saved'}</span> · <span className="font-mono">{c.reference}</span><br /><span className="text-xt-mute">Status: {c.status}</span></span>
                    {c.phone ? <a className="inline-flex min-h-11 items-center font-mono font-semibold text-xt-pine" href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`} target="_blank" rel="noreferrer">{c.phone}</a> : <span className="text-xt-mute">No number</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      ))}
      <p className="text-xs text-xt-mute">Visits are anonymous: no cookies or names are stored until a guest sends an enquiry. Online payments are off; past paid bookings stay at <Link to="/admin/bookings" className="underline">Paid bookings</Link>.</p>
    </div>
  );
}
