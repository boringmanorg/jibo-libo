import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTodaySummary } from '@/admin/consoleHome.functions';
import { PageHead, Panel, SheetChip, STATUS_LABEL, STATUS_STYLE, ago, dayMonth, freeTone, inrWhole, weekday } from '@/admin/components/ConsoleBits';

export const Route = createFileRoute('/(admin)/admin/')({ component: Today });

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function Today() {
  const fetchToday = useServerFn(getTodaySummary);
  const { data, error } = useQuery({ queryKey: ['console', 'today'], queryFn: () => fetchToday(), refetchInterval: 60_000 });
  if (error) return <p className="text-destructive">Could not load today’s summary. {(error as Error).message}</p>;
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const t = data.tonight;
  const maxBeds = Math.max(1, ...data.week.map((w) => w.beds.total));

  return (
    <div className="space-y-6">
      <PageHead title="Today" sub={longDate.format(new Date(`${data.today}T00:00:00Z`))}>
        <SheetChip syncedAt={data.sheetSyncedAt} />
      </PageHead>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {([['Dorm beds free tonight', t.beds], ['Private rooms free tonight', t.rooms], ['Shnonpedeng tents free', t.tents]] as const).map(([label, v]) => (
          <div key={label} className="rounded-[20px] bg-xt-ink p-3 text-xt-sand sm:rounded-[24px] sm:p-5">
            <p className="text-xs leading-snug text-xt-fog sm:text-sm">{label}</p>
            <p className="mt-2 flex items-baseline gap-2"><span className="xt-display text-4xl leading-none sm:text-6xl">{v.free}</span><span className="text-xs text-xt-fog sm:text-sm">of {v.total}</span></p>
          </div>
        ))}
      </div>

      <Panel title="Tonight, room by room" action={<Link to="/admin/inventory" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-xt-crimson">Open calendar <ArrowRight className="h-4 w-4" /></Link>}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.rows.map((r) => {
            const c = r.cells[0];
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-xt-sand px-4 py-3">
                <span className="min-w-0 text-[15px] font-semibold text-xt-ink">{r.short}{c.closed > 0 && <span className="ml-2 text-xs font-normal text-xt-mute">{c.closed} blocked</span>}</span>
                <span className={cn('shrink-0 rounded-full px-3 py-1 text-sm font-bold', freeTone(c.free, r.total))}>{c.free > 0 ? `${c.free} free` : 'Full'}</span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Dorm beds free, next 14 nights">
        <div className="flex h-36 items-end gap-1.5 sm:gap-2" role="list">
          {data.week.map((w, i) => (
            <Link key={w.night} to="/admin/inventory" search={{ start: w.night.slice(0, 7) }} role="listitem" aria-label={`${dayMonth(w.night)}: ${w.beds.free} of ${w.beds.total} beds free`}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-bold text-xt-ink">{w.beds.free}</span>
              <span className={cn('w-full rounded-t-lg transition-colors', w.beds.free === 0 ? 'bg-xt-crimson' : i === 0 ? 'bg-xt-ink' : 'bg-xt-stone group-hover:bg-xt-steel')}
                style={{ height: `${Math.max(4, (w.beds.free / maxBeds) * 100)}%` }} />
              <span className="text-[11px] leading-tight text-xt-mute">{weekday(w.night)}<br />{dayMonth(w.night).split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={data.newEnquiries ? `Inbox · ${data.newEnquiries} new` : 'Inbox'} action={<Link to="/admin/inbox" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-xt-crimson">Open inbox <ArrowRight className="h-4 w-4" /></Link>}>
          {!data.inboxReady ? <p className="text-sm text-xt-mute">The inbox starts collecting enquiries once this update’s database change has run.</p>
            : data.latestEnquiries.length === 0 ? <p className="text-sm text-xt-mute">No enquiries yet. Every enquiry sent from /book or the camp page lands here.</p>
            : (
              <ul className="divide-y divide-xt-line">
                {data.latestEnquiries.map((e: any) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-xt-ink">{e.guest_name}</span>
                      <span className="text-sm text-xt-mute">{e.kind === 'camp' ? 'Shnonpedeng · ' : ''}{dayMonth(e.check_in)} → {dayMonth(e.check_out)} · {e.guests} guest{e.guests === 1 ? '' : 's'} · {inrWhole(e.estimate_rupees)}</span>
                    </span>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', STATUS_STYLE[e.status])}>{STATUS_LABEL[e.status]}</span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title="What changed">
          {data.activity.length === 0 ? <p className="text-sm text-xt-mute">Nothing yet. Blocks and setting changes you make show here in plain words.</p> : (
            <ol className="space-y-3">
              {data.activity.map((a: { id: string; at: string; text: string }) => (
                <li key={a.id} className="flex gap-3 text-[15px]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-xt-crimson" aria-hidden />
                  <span className="min-w-0 flex-1 text-xt-ink">{a.text}<span className="block text-xs text-xt-mute">{ago(a.at)}</span></span>
                </li>
              ))}
            </ol>
          )}
          {data.activeBlocks > 0 && <p className="mt-4 text-sm text-xt-mute">{data.activeBlocks} block{data.activeBlocks === 1 ? '' : 's'} in force over the next 14 nights · <Link to="/admin/stays" className="font-semibold text-xt-crimson">See blocks</Link></p>}
        </Panel>
      </div>
    </div>
  );
}
