/**
 * TAB Bistro breakfast for a stay: dishes and beverages from the printed menu, each served every
 * morning of the stay. Prices come from src/data/breakfastMenu.ts (before GST).
 */
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BREAKFAST_ITEMS, MAX_BREAKFAST_QTY, type BreakfastItem, type BreakfastPick } from '@/data/breakfastMenu';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const GROUPS = ['Breakfast', 'Beverages'] as const;

export const picksToList = (p: Record<string, number>): BreakfastPick[] =>
  Object.entries(p).filter(([, q]) => q > 0).map(([item, qty]) => ({ item, qty }));

export default function BreakfastPicker({ picks, onChange, mornings }: { picks: Record<string, number>; onChange: (p: Record<string, number>) => void; mornings: number }) {
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('Breakfast');
  const set = (id: string, qty: number) => onChange({ ...picks, [id]: Math.max(0, Math.min(MAX_BREAKFAST_QTY, qty)) });
  const chosen = BREAKFAST_ITEMS.filter((i) => (picks[i.id] ?? 0) > 0);
  const perMorning = chosen.reduce((s, i) => s + i.price * picks[i.id], 0);
  const categories = [...new Set(BREAKFAST_ITEMS.filter((i) => i.group === group).map((i) => i.category))];

  return (
    <div>
      <p className="mb-3 text-sm text-xt-mute">Pick dishes and drinks from the TAB Bistro menu. Each is served every morning of your stay, 8:45 AM to 12 PM. Prices are before 5% GST.</p>
      <div className="inline-flex rounded-full border border-xt-line bg-white/60 p-1" role="tablist" aria-label="Breakfast menu">
        {GROUPS.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)}
            className={cn('min-h-10 rounded-full px-4 text-sm font-semibold', group === g ? 'bg-xt-ink text-xt-sand' : 'text-xt-mute hover:text-xt-ink')}>{g}</button>
        ))}
      </div>
      <div className="mt-3 max-h-[420px] space-y-4 overflow-y-auto rounded-2xl border border-xt-line bg-white p-3">
        {categories.map((c) => (
          <div key={c}>
            <p className="px-1 pb-1 text-xs font-bold uppercase tracking-wide text-xt-mute">{c}</p>
            <ul className="divide-y divide-xt-line">
              {BREAKFAST_ITEMS.filter((i) => i.group === group && i.category === c).map((i) => <Item key={i.id} item={i} qty={picks[i.id] ?? 0} onQty={(q) => set(i.id, q)} />)}
            </ul>
          </div>
        ))}
      </div>
      {chosen.length > 0 && (
        <div className="mt-3 rounded-2xl bg-xt-cream p-4 text-sm text-xt-ink">
          <p className="font-semibold">Each morning: {chosen.map((i) => `${picks[i.id]} × ${i.name}`).join(', ')}</p>
          <p className="mt-1 text-xt-mute">{inr(perMorning)} a morning × {mornings} morning{mornings === 1 ? '' : 's'} = {inr(perMorning * mornings)}, plus GST</p>
          <button type="button" onClick={() => onChange({})} className="mt-2 min-h-10 text-sm font-semibold text-xt-crimson underline">Clear breakfast</button>
        </div>
      )}
    </div>
  );
}

function Item({ item, qty, onQty }: { item: BreakfastItem; qty: number; onQty: (q: number) => void }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 text-sm text-xt-ink">{item.name}<span className="block text-xs text-xt-mute">{inr(item.price)}</span></span>
      {qty === 0 ? (
        <button type="button" onClick={() => onQty(1)} className="min-h-12 shrink-0 rounded-full border border-xt-ink px-5 text-sm font-semibold text-xt-ink">Add</button>
      ) : (
        <span className="flex shrink-0 items-center gap-1" role="group" aria-label={`${item.name} quantity`}>
          <button type="button" aria-label={`One less ${item.name}`} onClick={() => onQty(qty - 1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-xt-line"><Minus className="h-4 w-4" /></button>
          <output className="w-6 text-center font-bold">{qty}</output>
          <button type="button" aria-label={`One more ${item.name}`} disabled={qty >= MAX_BREAKFAST_QTY} onClick={() => onQty(qty + 1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-xt-line disabled:opacity-35"><Plus className="h-4 w-4" /></button>
        </span>
      )}
    </li>
  );
}
