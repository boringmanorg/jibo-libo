/**
 * Homepage guest reviews: floating review cards around a centred headline
 * (testimonial template), a review pop-up for each card, and a full list of
 * every saved review. Review text is verbatim from the review data modules.
 */
import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { featuredHostelReviews, featuredBistroReviews } from '@/data/featuredGoogleReviews';
import { googleReviews } from '@/data/googleReviews';

type R = { name: string; rating: number; comment: string; date: string; property: string; source: string; ownerReply?: string };

function allReviews(): R[] {
  const seen = new Set<string>();
  const out: R[] = [];
  const add = (r: Omit<R, 'source'> & { source?: string }) => {
    const key = `${r.name}|${r.comment.slice(0, 40)}`.toLowerCase();
    if (seen.has(key) || !r.comment.trim()) return;
    seen.add(key);
    out.push({ ...r, property: r.property || 'XTSY Travellers Hostel', source: r.source ?? 'Google' });
  };
  [...featuredHostelReviews, ...featuredBistroReviews, ...googleReviews].forEach(add);
  return out;
}

// Desktop layout from the testimonial template: full review cards plus
// smaller guest tiles of varied sizes scattered around the headline.
const SPOTS: { l: number; t: number; r: number; tile?: number }[] = [
  { l: 2, t: 6, r: -4 }, { l: 4, t: 56, r: 3 }, { l: 77, t: 5, r: 4 }, { l: 79, t: 52, r: -3 }, { l: 60, t: 80, r: 2 },
  { l: 27, t: 6, r: 0, tile: 80 }, { l: 66, t: 30, r: 0, tile: 64 }, { l: 22, t: 42, r: 0, tile: 72 },
  { l: 28, t: 82, r: 0, tile: 88 }, { l: 46, t: 86, r: 0, tile: 60 }, { l: 62, t: 4, r: 0, tile: 70 },
];
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function Tile({ r, size, onOpen }: { r: R; size: number; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`Read review by ${r.name}`} style={{ width: size, height: size }}
      className="flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-xt-crimson text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,.6)] transition-transform hover:scale-110">
      <span className="xt-display text-[22px] leading-none">{initials(r.name)}</span>
      <span className="text-[10px] tracking-[1px]">{'★'.repeat(r.rating)}</span>
    </button>
  );
}

const Stars = ({ n }: { n: number }) => (
  <span aria-label={`${n} out of 5 stars`} className="tracking-[2px] text-xt-crimson">{'★'.repeat(n)}<span className="text-xt-line">{'★'.repeat(5 - n)}</span></span>
);

function Card({ r, onOpen, className = '', style }: { r: R; onOpen: () => void; className?: string; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={onOpen} style={style}
      className={`flex min-h-12 w-[230px] flex-col gap-2 rounded-2xl bg-xt-paper p-4 text-left text-xt-ink shadow-[0_18px_40px_-18px_rgba(0,0,0,.6)] transition-transform hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-xt-crimson ${className}`}>
      <Stars n={r.rating} />
      <span className="line-clamp-3 text-[14px] leading-snug">{r.comment}</span>
      <span className="text-[12px] font-bold text-xt-mute">{r.name} · {r.property === 'TAB Bistro by XTSY' ? 'TAB Bistro' : 'Hostel'}</span>
    </button>
  );
}

export function Reviews() {
  const reviews = useMemo(allReviews, []);
  const floating = useMemo(() => {
    const bistro = reviews.filter((r) => r.property === 'TAB Bistro by XTSY').slice(0, 2);
    const hostel = reviews.filter((r) => r.property !== 'TAB Bistro by XTSY').slice(0, SPOTS.length - bistro.length);
    return [...hostel.slice(0, 4), ...bistro.slice(0, 1), ...bistro.slice(1), ...hostel.slice(4)];
  }, [reviews]);
  const [open, setOpen] = useState<R | null>(null);
  const [all, setAll] = useState(false);
  const [tab, setTab] = useState<'all' | 'hostel' | 'bistro'>('all');
  const list = reviews.filter((r) => tab === 'all' || (tab === 'bistro') === (r.property === 'TAB Bistro by XTSY'));

  return (
    <section className="px-4 pb-20 sm:px-8 lg:px-14">
      <div className="relative overflow-hidden rounded-[32px] bg-xt-night px-5 py-16 text-white sm:px-10 lg:min-h-[640px] lg:py-24">
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          {floating.map((r, i) => (
            <div key={r.name + i} className="xt-review-pop pointer-events-auto absolute" style={{ left: `${SPOTS[i].l}%`, top: `${SPOTS[i].t}%`, animationDelay: `${(i % 5) * 0.08}s` }}>
              <div className="xt-review-float" style={{ ['--r' as string]: `${SPOTS[i].r}deg`, animationDelay: `${-i * 1.1}s`, animationDuration: `${6 + (i % 4)}s` } as React.CSSProperties}>
                {SPOTS[i].tile ? <Tile r={r} size={SPOTS[i].tile!} onOpen={() => setOpen(r)} /> : <Card r={r} onOpen={() => setOpen(r)} />}
              </div>
            </div>
          ))}
        </div>

        <div className="relative mx-auto flex max-w-[620px] flex-col items-center gap-5 text-center">
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-[14px] font-bold">Guest reviews</span>
          <h2 className="xt-display m-0 text-[48px] leading-[0.95] sm:text-[72px]">4.7 on Google from 252 reviews</h2>
          <p className="m-0 text-[16px] leading-relaxed text-xt-fog sm:text-[18px]">Real words from guests of XTSY Travellers Hostel and TAB Bistro by XTSY. 9.4 on Booking.com.</p>
          <button type="button" onClick={() => setAll(true)} className="xt-btn flex h-14 items-center gap-2 rounded-full bg-xt-crimson px-7 text-[16px] font-extrabold text-white">
            Read {reviews.length} guest reviews <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        <div className="relative -mx-5 mt-10 flex snap-x gap-4 overflow-x-auto px-5 pb-2 lg:hidden">
          {floating.slice(0, 5).map((r, i) => <Card key={r.name + i} r={r} onOpen={() => setOpen(r)} className="shrink-0 snap-start" />)}
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg rounded-3xl bg-xt-paper text-xt-ink">
          {open && (<>
            <DialogTitle className="flex flex-col gap-1 text-[20px]">{open.name}<span className="text-[14px] font-semibold text-xt-mute">{open.property} · {open.source} · {open.date}</span></DialogTitle>
            <Stars n={open.rating} />
            <DialogDescription className="text-[16px] leading-relaxed text-xt-ink">{open.comment}</DialogDescription>
            {open.ownerReply && <p className="m-0 rounded-2xl bg-xt-cream p-4 text-[14px] leading-relaxed"><b>Reply from XTSY:</b> {open.ownerReply}</p>}
          </>)}
        </DialogContent>
      </Dialog>

      <Dialog open={all} onOpenChange={setAll}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-3xl bg-xt-paper text-xt-ink">
          <DialogTitle className="text-[22px]">Guest reviews</DialogTitle>
          <DialogDescription className="text-xt-mute">4.7★ from 252 Google reviews. {reviews.length} reviews saved on this site, shown word for word.</DialogDescription>
          <div className="flex flex-wrap gap-2">
            {([['all', 'All'], ['hostel', 'XTSY Travellers Hostel'], ['bistro', 'TAB Bistro by XTSY']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`min-h-12 rounded-full px-4 text-[14px] font-bold ${tab === k ? 'bg-xt-crimson text-white' : 'bg-xt-cream text-xt-ink'}`}>{l}</button>
            ))}
          </div>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {list.map((r, i) => (
              <li key={r.name + i} className="flex flex-col gap-2 rounded-2xl bg-white p-4">
                <Stars n={r.rating} />
                <p className="m-0 text-[15px] leading-relaxed">{r.comment}</p>
                <span className="text-[13px] font-bold text-xt-mute">{r.name} · {r.property} · {r.date}</span>
                {r.ownerReply && <p className="m-0 rounded-xl bg-xt-cream p-3 text-[13px]"><b>Reply:</b> {r.ownerReply}</p>}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}
