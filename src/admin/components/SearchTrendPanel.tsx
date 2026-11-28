import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import type { DailyDemand, SearchQuery } from '@/admin/demandTrends';

export interface TrendReading {
  recentImpressions: number; baselineWeekly: number; ratio: number; multiplier: number;
  windowEnd: string; capturedAt: string; daily: DailyDemand[]; topQueries: SearchQuery[];
}
const number = (n: number) => n.toLocaleString('en-IN');
const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function SearchTrendPanel({ area, subtitle, reading, loading, camp = false }: { area: string; subtitle: string; reading: TrendReading | undefined; loading: boolean; camp?: boolean }) {
  const [period, setPeriod] = useState<7 | 35>(35);
  const [metric, setMetric] = useState<'impressions' | 'clicks'>('impressions');
  const [table, setTable] = useState(false);
  const series = reading?.daily.slice(-period) ?? [];
  const change = reading && reading.baselineWeekly > 0 ? Math.round((reading.recentImpressions / reading.baselineWeekly - 1) * 100) : null;
  const stale = reading && Date.now() - Date.parse(reading.capturedAt) >= 14 * 86_400_000;
  return <section className="min-w-0 rounded-lg border border-xt-line bg-background p-4 sm:p-5" aria-label={`${area} search trends`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-xl font-bold">{area}</h3><p className="mt-1 text-sm text-xt-mute">{subtitle}</p></div>
      <span className="text-xs font-semibold text-xt-mute">{camp ? 'Planning only' : 'Hostel demand'}</span>
    </div>
    {!reading ? <p className="py-12 text-sm text-xt-mute">{loading ? 'Loading Google reading…' : 'No saved Google reading.'}</p> : <>
      <dl className="my-5 grid grid-cols-3 gap-3">
        <div><dt className="text-xs text-xt-mute">7-day appearances</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{number(reading.recentImpressions)}</dd></div>
        <div><dt className="text-xs text-xt-mute">Usual week</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{number(reading.baselineWeekly)}</dd></div>
        <div><dt className="text-xs text-xt-mute">Search change</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`}</dd></div>
      </dl>
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label={`${area} chart metric`}>
          {(['impressions', 'clicks'] as const).map((v) => <Button key={v} variant={metric === v ? 'secondary' : 'ghost'} className="min-h-12 px-3" aria-pressed={metric === v} onClick={() => setMetric(v)}>{v === 'impressions' ? 'Appearances' : 'Clicks'}</Button>)}
        </div>
        <div className="flex gap-1" role="group" aria-label={`${area} chart period`}>
          {([7, 35] as const).map((v) => <Button key={v} variant={period === v ? 'secondary' : 'ghost'} className="min-h-12 px-3" aria-pressed={period === v} onClick={() => setPeriod(v)}>{v} days</Button>)}
        </div>
      </div>
      {series.length ? <div className="mt-4 h-56 w-full" role="img" aria-label={`${area}: daily ${metric}, ${date(series[0]?.date ?? reading.windowEnd)} to ${date(reading.windowEnd)}`}>
        <ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-xt-line)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={date} minTickGap={28} tick={{ fill: 'var(--color-xt-mute)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--color-xt-mute)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(v) => date(String(v))} contentStyle={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', borderColor: 'hsl(var(--border))', borderRadius: 8 }} />
          <Line type="linear" dataKey={metric} name={metric === 'impressions' ? 'Appearances' : 'Clicks'} stroke={camp ? 'var(--color-xt-ink)' : 'var(--color-xt-crimson)'} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart></ResponsiveContainer>
      </div> : <p className="my-6 text-sm text-xt-mute">This older reading has no daily history. Refresh Google data to load the chart.</p>}
      <p className="mt-3 text-xs text-xt-mute">Data through {date(reading.windowEnd)} · refreshed {new Date(reading.capturedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST{stale ? ' · Stale: excluded from automatic pricing' : ''}</p>
      <p className="mt-2 text-sm">{camp ? 'Campsite rates stay fixed; this trend does not change them.' : `Current automatic search factor: ${stale ? 'neutral' : `${Math.round((reading.multiplier - 1) * 100) > 0 ? '+' : ''}${Math.round((reading.multiplier - 1) * 100)}%`}. Your saved room limits still apply.`}</p>
      <div className="mt-5 border-t border-xt-line pt-4">
        <h4 className="text-sm font-semibold">Leading searches · last 7 days</h4>
        {reading.topQueries.length ? <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-xt-mute"><tr><th className="py-2 font-medium">Search</th><th className="px-2 text-right font-medium">Appearances</th><th className="text-right font-medium">Clicks</th></tr></thead><tbody>{reading.topQueries.map((q) => <tr key={q.query} className="border-t border-xt-line"><td className="py-3 pr-3 break-words">{q.query}</td><td className="px-2 text-right tabular-nums">{number(q.impressions)}</td><td className="text-right tabular-nums">{number(q.clicks)}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-xt-mute">No matching searches in this reading.</p>}
      </div>
      {series.length > 0 && <><Button variant="ghost" className="mt-2 min-h-12" onClick={() => setTable(!table)} aria-expanded={table}>{table ? 'Hide daily values' : 'Daily values'}</Button>{table && <table className="mt-2 w-full text-left text-sm"><thead><tr><th>Date</th><th className="text-right">Appearances</th><th className="text-right">Clicks</th></tr></thead><tbody>{series.map((d) => <tr key={d.date} className="border-t border-xt-line"><td className="py-2">{date(d.date)}</td><td className="text-right tabular-nums">{number(d.impressions)}</td><td className="text-right tabular-nums">{number(d.clicks)}</td></tr>)}</tbody></table>}</>}
    </>}
  </section>;
}