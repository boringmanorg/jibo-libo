import { buildRouteHead } from '@/lib/seo-head';
import { useSheetDoorbell } from '@/hooks/useSheetDoorbell';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useConsoleProperty } from '@/admin/consoleScope';
import { cn } from '@/lib/utils';
import { getInventoryCalendar } from '@/admin/consoleHome.functions';
import { saveInventoryOverride } from '@/admin/console.functions';
import type { CalendarCell, CalendarRow } from '@/admin/inventoryCalendar';
import { PageHead, SheetChip, dayMonth, freeTone, weekday } from '@/admin/components/ConsoleBits';
import { DateRangeBar, useConsoleRange } from '@/admin/components/DateRangeBar';
import { daysOf, dayHeading } from '@/admin/dateRange';

export const Route = createFileRoute('/(admin)/admin/inventory')({
  validateSearch: z.object({ start: z.string().regex(/^\d{4}-\d{2}$/).optional(), view: z.string().max(8).optional() }),
  head: () => buildRouteHead({ path: '/admin/inventory', title: 'Inventory — XTSY Console', description: 'XTSY room inventory and hostel availability.', noIndex: true }),
  component: Inventory,
});

const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const thisMonth = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 7);
const shift = (ym: string, by: number) => { const d = new Date(`${ym}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + by); return d.toISOString().slice(0, 7); };
const daysIn = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();

function Inventory() {
  const { view } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const list = view !== 'grid';
  return <div>
    <div role="tablist" aria-label="Inventory view" className="mb-4 inline-flex rounded-full border border-xt-line bg-white p-1">
      {([['list', 'Day list'], ['grid', 'Month grid']] as const).map(([v, label]) => <button key={v} type="button" role="tab" aria-selected={(v === 'list') === list}
        onClick={() => void navigate({ search: (prev) => ({ ...prev, view: v }), replace: true })}
        className={cn('min-h-[44px] rounded-full px-5 text-sm font-bold', (v === 'list') === list ? 'bg-xt-ink text-xt-sand' : 'text-xt-mute')}>{label}</button>)}
    </div>
    {list ? <InventoryDays /> : <InventoryGrid />}
  </div>;
}

function InventoryDays() {
  const property = useConsoleProperty();
  const range = useConsoleRange('next7');
  const nights = daysOf(range).slice(0, 62);
  const fetchCal = useServerFn(getInventoryCalendar);
  const { data, error } = useQuery({
    queryKey: ['console', 'calendar', 'days', range.from, nights.length],
    queryFn: () => fetchCal({ data: { start: range.from, days: nights.length } }),
  });
  const qcDoor = useQueryClient();
  useSheetDoorbell(() => { void qcDoor.invalidateQueries({ queryKey: ['console'] }); });
  const [picked, setPicked] = useState<{ row: CalendarRow; cell: CalendarCell } | null>(null);
  const rows = (data?.rows ?? []).filter((r) => !property || r.propertyId === property);
  return <div className="space-y-4">
    <PageHead title="Inventory" sub="Day by day: what /book offers each night after console blocks and OTA holds.">{data && <SheetChip syncedAt={data.sheetSyncedAt} />}</PageHead>
    <DateRangeBar fallback="next7" />
    {error && <p className="text-destructive">Could not load inventory. {(error as Error).message}</p>}
    {!data ? <p className="text-muted-foreground">Loading…</p> : nights.map((night, i) => {
      let total = 0, free = 0, closed = 0, ota = 0;
      for (const r of rows) { const c = r.cells[i]; if (c && !c.sheetMissing) { total += c.start; free += c.free; closed += c.closed; ota += c.ota; } }
      const occ = total ? Math.round(((total - free) / total) * 100) : 0;
      return <details key={night} open={i < 3} className="rounded-[24px] border border-xt-line bg-white">
        <summary className="grid min-h-[60px] cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5">
          <span className="min-w-0"><span className="block font-extrabold text-xt-ink">{dayHeading(night, data.today)}</span><span className="block text-xs text-xt-mute">{free} free of {total}{closed ? ` · ${closed} blocked` : ''}{ota ? ` · ${ota} OTA` : ''}</span></span>
          <span className={cn('rounded-full px-3 py-1 text-sm font-extrabold tabular-nums', occ >= 90 ? 'bg-xt-blush text-xt-crimson-dark' : occ >= 60 ? 'bg-amber-100 text-amber-900' : 'bg-xt-leaf/15 text-xt-ink')}>{occ}% full</span>
        </summary>
        <ul className="divide-y divide-xt-line border-t border-xt-line">{rows.map((row) => { const cell = row.cells[i]; if (!cell) return null; const past = night < data.today; return <li key={row.id}>
          <button type="button" disabled={past} onClick={() => setPicked({ row, cell })} className="grid min-h-[52px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-2 text-left text-sm hover:bg-xt-cream disabled:cursor-default disabled:hover:bg-transparent">
            <span className="min-w-0 truncate font-semibold text-xt-ink">{row.short}<span className="ml-2 font-normal text-xt-mute">{row.total} {row.unit}{row.total === 1 ? '' : 's'}</span></span>
            <span className={cn('shrink-0 rounded-lg px-3 py-1 font-bold tabular-nums', cell.sheetMissing ? 'text-xt-mute' : freeTone(cell.free, row.total))}>{cell.sheetMissing ? 'Not in sheet' : `${cell.free} free`}{cell.closed ? ` · ${cell.closed} blocked` : ''}</span>
          </button></li>; })}</ul>
      </details>;
    })}
    {picked && <NightPanel row={picked.row} cell={picked.cell} onClose={() => setPicked(null)} />}
  </div>;
}

function InventoryGrid() {
  const { start } = Route.useSearch();
  const property = useConsoleProperty();
  const month = start ?? thisMonth();
  const navigate = useNavigate({ from: Route.fullPath });
  const go = (ym: string) => navigate({ search: (prev) => ({ ...prev, start: ym }) });
  const fetchCal = useServerFn(getInventoryCalendar);
  const { data, error, isFetching } = useQuery({
    queryKey: ['console', 'calendar', month],
    queryFn: () => fetchCal({ data: { start: `${month}-01`, days: daysIn(month) } }),
  });
  const qcDoor = useQueryClient();
  useSheetDoorbell(() => { void qcDoor.invalidateQueries({ queryKey: ['console'] }); });
  const [picked, setPicked] = useState<{ row: CalendarRow; cell: CalendarCell } | null>(null);
  // Start the grid at today (a couple of days back for context) instead of the 1st.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('[data-today]');
    if (el && scroller.current) scroller.current.scrollLeft = Math.max(0, el.offsetLeft - (window.innerWidth < 640 ? 120 : 176) - 2 * el.offsetWidth);
  }, [data?.start]);

  return (
    <div>
      <PageHead title="Inventory" sub="What /book offers each night: your Google Sheet’s numbers, less any blocks set here.">
        {data && <SheetChip syncedAt={data.sheetSyncedAt} />}
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(shift(month, -1))} aria-label="Previous month" className="flex h-11 w-11 items-center justify-center rounded-full border border-xt-line bg-white hover:border-xt-stone"><ChevronLeft className="h-5 w-5" /></button>
          <p className="min-w-[10rem] text-center text-lg font-extrabold text-xt-ink" aria-live="polite">{monthName.format(new Date(`${month}-01T00:00:00Z`))}</p>
          <button type="button" onClick={() => go(shift(month, 1))} aria-label="Next month" className="flex h-11 w-11 items-center justify-center rounded-full border border-xt-line bg-white hover:border-xt-stone"><ChevronRight className="h-5 w-5" /></button>
          {month !== thisMonth() && <button type="button" onClick={() => go(thisMonth())} className="min-h-11 rounded-full px-4 text-sm font-semibold text-xt-crimson">This month</button>}
          {isFetching && <span className="text-sm text-xt-mute">Updating…</span>}
        </div>
        <Legend />
      </div>

      {error && <p className="text-destructive">Could not load the calendar. {(error as Error).message}</p>}
      {!data ? <p className="text-muted-foreground">Loading…</p> : (
        <div ref={scroller} className="overflow-x-auto rounded-[24px] border border-xt-line bg-white">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-[7.5rem] border-b sm:min-w-[11rem] border-xt-line bg-white px-4 py-3 text-left font-semibold text-xt-mute">Room</th>
                {data.rows.filter((r) => !property || r.propertyId === property)[0]?.cells.map((c) => {
                  const wkend = ['Sat', 'Sun'].includes(weekday(c.night));
                  return (
                    <th key={c.night} scope="col" data-today={c.night === data.today || undefined} className={cn('min-w-[3.25rem] border-b border-xt-line px-1 py-2 text-center font-normal', c.night === data.today ? 'bg-xt-ink text-xt-sand' : wkend ? 'bg-xt-sand text-xt-ink' : 'text-xt-mute')}>
                      <span className="block text-[11px]">{weekday(c.night)}</span>
                      <span className="block font-bold">{Number(c.night.slice(8, 10))}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.rows.filter((r) => !property || r.propertyId === property).map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-xt-line bg-white px-3 py-2 text-left sm:px-4">
                    <span className="block font-semibold text-xt-ink">{row.short}</span>
                    <span className="text-xs text-xt-mute">{row.total} {row.unit}{row.total === 1 ? '' : 's'}{row.source === 'catalogue' ? ' · set here' : ''}</span>
                  </th>
                  {row.cells.map((cell) => {
                    const past = cell.night < data.today;
                    return (
                      <td key={cell.night} className="border-b border-xt-line p-1">
                        {past ? <span className="block h-11 min-w-[2.75rem] rounded-lg bg-xt-sand/60" aria-hidden /> : (
                        <button type="button" onClick={() => setPicked({ row, cell })}
                          aria-label={`${row.short}, ${dayMonth(cell.night)}: ${cell.sheetMissing ? 'not in the sheet' : `${cell.free} of ${cell.start} free`}${cell.closed ? `, ${cell.closed} blocked` : ''}${cell.ota ? `, ${cell.ota} held by OTA bookings` : ''}`}
                          className={cn('relative flex h-11 w-full min-w-[2.75rem] flex-col items-center justify-center rounded-lg text-[15px] font-bold transition-shadow hover:ring-2 hover:ring-xt-ink disabled:opacity-40 disabled:hover:ring-0',
                            cell.sheetMissing ? 'bg-[repeating-linear-gradient(135deg,#EFE6DA_0_6px,#F6F1EA_6px_12px)] text-xt-mute' : freeTone(cell.free, row.total))}>
                          {cell.sheetMissing ? '–' : cell.free}
                          {cell.closed > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-xt-crimson" aria-hidden />}
                        </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-sm text-xt-mute">Hostel numbers come from your Google Sheet (read only). To change how many beds a night starts with, edit the sheet; to hold some back from /book, tap a night and block it here.</p>

      {picked && <NightPanel row={picked.row} cell={picked.cell} onClose={() => setPicked(null)} />}
    </div>
  );
}

function Legend() {
  const item = (cls: string, label: string) => <span className="flex items-center gap-1.5"><span className={cn('h-4 w-4 rounded', cls)} aria-hidden />{label}</span>;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-xt-mute">
      {item('bg-xt-leaf/15', 'Open')}{item('bg-amber-100', 'Nearly full')}{item('bg-xt-blush', 'Full')}
      {item('bg-[repeating-linear-gradient(135deg,#EFE6DA_0_4px,#F6F1EA_4px_8px)]', 'Not in sheet')}
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-xt-crimson" aria-hidden />Blocked here</span>
    </div>
  );
}

function NightPanel({ row, cell, onClose }: { row: CalendarRow; cell: CalendarCell; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveInventoryOverride);
  const [count, setCount] = useState('');
  const m = useMutation({
    mutationFn: (v: { state: 'blocked' | 'open'; units?: number }) => save({ data: { propertyId: row.propertyId, unitTypeId: row.consoleUnitId, startDate: cell.night, endDate: cell.night, state: v.state, units: v.units } }),
    onSuccess: (_r, v) => { toast.success(v.state === 'open' ? 'Reopened for /book' : 'Blocked on /book'); void qc.invalidateQueries({ queryKey: ['console'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const n = Number(count);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-xt-ink/30 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="night-title" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[28px] bg-white p-6 shadow-xl sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-xt-mute">{weekday(cell.night)} {dayMonth(cell.night)}</p>
            <h2 id="night-title" className="xt-display text-4xl leading-none text-xt-ink">{row.short}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-xt-cream"><X className="h-5 w-5" /></button>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          {([[row.source === 'sheet' ? 'From sheet' : 'Total', cell.sheetMissing ? '–' : cell.start], ['Blocked here', cell.closed], ['OTA bookings (until the sheet is updated)', cell.ota], ['On /book', cell.free]] as const).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-xt-sand p-3"><dt className="text-xs text-xt-mute">{k}</dt><dd className="xt-display text-3xl text-xt-ink">{v}</dd></div>
          ))}
        </dl>
        {cell.sheetMissing && <p className="mt-3 text-sm text-xt-mute">Your sheet has no number for this night, so /book doesn’t offer it. Add the month or the number in the sheet.</p>}
        <div className="mt-5 space-y-3">
          <button type="button" disabled={m.isPending || cell.free === 0} onClick={() => m.mutate({ state: 'blocked' })} className="min-h-12 w-full rounded-full bg-xt-crimson font-bold text-white disabled:opacity-40">Block all for this night</button>
          {row.total > 1 && (
            <div className="flex gap-2">
              <input type="number" min={1} max={Math.max(1, cell.free)} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder={`How many ${row.unit}s`} aria-label={`How many ${row.unit}s to block`}
                className="h-12 min-w-0 flex-1 rounded-full border border-xt-line px-4 text-base" />
              <button type="button" disabled={m.isPending || !(n >= 1 && n <= cell.free)} onClick={() => m.mutate({ state: 'blocked', units: n })} className="min-h-12 shrink-0 rounded-full border border-xt-ink px-5 font-bold text-xt-ink disabled:opacity-40">Block some</button>
            </div>
          )}
          {cell.closed > 0 && <button type="button" disabled={m.isPending} onClick={() => m.mutate({ state: 'open' })} className="min-h-12 w-full rounded-full bg-xt-ink font-bold text-xt-sand disabled:opacity-40">Reopen this night</button>}
        </div>
        <p className="mt-4 text-xs text-xt-mute">For several nights or the whole property, use Blocks.</p>
      </div>
    </div>
  );
}
