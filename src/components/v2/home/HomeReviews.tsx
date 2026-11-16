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

// Desktop layout from the testimonial template: review cards in two
// staggered columns on each side of the centred headline.
const SPOTS: { side: 'left' | 'right'; x: number; t: number; r: number }[] = [
  { side: 'left', x: 1, t: 3, r: -3 }, { side: 'right', x: 1, t: 5, r: 3 }, { side: 'left', x: 11, t: 28, r: 2 }, { side: 'right', x: 11, t: 30, r: -2 },
  { side: 'left', x: 1, t: 54, r: 3 }, { side: 'right', x: 1, t: 56, r: -3 }, { side: 'left', x: 11, t: 78, r: -2 }, { side: 'right', x: 11, t: 79, r: 2 },
]

const Stars = ({ n }: { n: number }) => (
  <span aria-label={`${n} out of 5 stars`} className="tracking-[2px] text-xt-crimson">{'★'.repeat(n)}<span className="text-xt-line">{'★'.repeat(5 - n)}</span></span>
);

function Card({ r, onOpen, className = '', style }: { r: R; onOpen: () => void; className?: string; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={onOpen} style={style}
      className={`flex min-h-12 relative h-full w-[260px] sm:w-full flex-col gap-3 rounded-3xl border border-xt-line/60 bg-xt-paper p-5 pt-6 text-left text-xt-ink shadow-[0_18px_40px_-18px_rgba(0,0,0,.6)] transition-transform hover:-translate-y-1 hover:shadow-[0_28px_50px_-20px_rgba(0,0,0,.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-xt-crimson ${className}`}>
      <span aria-hidden className="xt-display absolute right-5 top-2 text-[56px] leading-none text-xt-crimson/20">&ldquo;</span>
      <Stars n={r.rating} />
      <span className="line-clamp-5 flex-1 whitespace-pre-line text-[15px] leading-relaxed">{r.comment}</span>
      <span className="border-t border-xt-line/60 pt-3 text-[13px] font-bold text-xt-mute">{r.name} · {r.property === 'TAB Bistro by XTSY' ? 'TAB Bistro' : r.property === 'Experience by XTSY' ? `Glass suite · ${r.source}` : 'Hostel'}</span>
    </button>
  );
}

export type ReviewShowcaseProps = {
  /** Only reviews whose text matches this pattern (verbatim reviews, filtered by topic). */
  match?: RegExp;
  /** Include featured TAB Bistro reviews regardless of `match`. */
  bistro?: boolean;
  badge?: string;
  title?: string;
  description?: string;
  /** Extra verbatim reviews shown first (e.g. Airbnb reviews for one listing). */
  extra?: R[];
};

export function Reviews({ extra = [], match, bistro, badge = 'Guest reviews', title = '4.7 on Google from 252 reviews', description = 'Real words from guests of XTSY Travellers Hostel and TAB Bistro by XTSY. 9.4 on Booking.com.' }: ReviewShowcaseProps = {}) {
  const reviews = useMemo(() => {
    const all = allReviews();
    if (!match) return [...extra, ...all];
    return [...extra, ...all.filter((r) => (bistro && r.property === 'TAB Bistro by XTSY') || match.test(r.comment))];
  }, [match, bistro, extra]);
  const floating = useMemo(() => {
    const good = reviews.filter((r) => r.rating >= 4 && r.comment.length > 25);
    const b = good.filter((r) => r.property === 'TAB Bistro by XTSY');
    const h = good.filter((r) => r.property !== 'TAB Bistro by XTSY');
    const mixed = match ? (bistro ? [...b, ...h] : good) : [...h.slice(0, 5), ...b.slice(0, 2), ...h.slice(5)];
    return mixed.slice(0, SPOTS.length);
  }, [reviews, match, bistro]);
  const [open, setOpen] = useState<R | null>(null);
  const [all, setAll] = useState(false);
  const [tab, setTab] = useState<'all' | 'hostel' | 'bistro'>('all');
  const list = reviews.filter((r) => tab === 'all' || (tab === 'bistro') === (r.property === 'TAB Bistro by XTSY'));

  return (
    <section className="px-4 pb-20 sm:px-8 lg:px-14">
      <div className="relative overflow-hidden rounded-[32px] bg-xt-night px-5 py-14 text-white sm:px-10 lg:px-14 lg:py-16">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[70%] -translate-x-1/2 rounded-full bg-xt-crimson/25 blur-3xl" />
        <div className="relative mx-auto flex max-w-[860px] flex-col items-center gap-4 text-center">
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[13px] font-bold uppercase tracking-[0.18em]">{badge}</span>
          <h2 className="xt-display m-0 text-[42px] leading-[0.95] sm:text-[64px] lg:text-[76px]">{title}</h2>
          <p className="m-0 max-w-[620px] text-[16px] leading-relaxed text-xt-fog sm:text-[18px]">{description}</p>
          <button type="button" onClick={() => setAll(true)} className="xt-btn mt-2 flex h-14 items-center gap-2 rounded-full bg-xt-crimson px-7 text-[16px] font-extrabold text-white">
            Read {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'} <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        <div className="relative -mx-5 mt-12 flex snap-x gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:gap-5">
          {floating.map((r, i) => (
            <div key={r.name + i} className={`xt-review-pop shrink-0 snap-start ${i % 2 ? 'lg:translate-y-8' : ''}`} style={{ animationDelay: `${(i % 4) * 0.08}s` }}>
              <Card r={r} onOpen={() => setOpen(r)} />
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg rounded-3xl bg-xt-paper text-xt-ink">
          {open && (<>
            <DialogTitle className="flex flex-col gap-1 text-[20px]">{open.name}<span className="text-[14px] font-semibold text-xt-mute">{open.property} · {open.source} · {open.date}</span></DialogTitle>
            <Stars n={open.rating} />
            <DialogDescription className="whitespace-pre-line text-[16px] leading-relaxed text-xt-ink">{open.comment}</DialogDescription>
            {open.ownerReply && <p className="m-0 rounded-2xl bg-xt-cream p-4 text-[14px] leading-relaxed"><b>Reply from XTSY:</b> {open.ownerReply}</p>}
          </>)}
        </DialogContent>
      </Dialog>

      <Dialog open={all} onOpenChange={setAll}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-3xl bg-xt-paper text-xt-ink">
          <DialogTitle className="text-[22px]">{badge}</DialogTitle>
          <DialogDescription className="text-xt-mute">{reviews.length} reviews shown word for word{match ? ' that mention this topic' : ''}. XTSY Travellers Hostel is rated 4.7★ from 252 Google reviews.</DialogDescription>
          <div className="flex flex-wrap gap-2">
            {!match && ([['all', 'All'], ['hostel', 'XTSY Travellers Hostel'], ['bistro', 'TAB Bistro by XTSY']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`min-h-12 rounded-full px-4 text-[14px] font-bold ${tab === k ? 'bg-xt-crimson text-white' : 'bg-xt-cream text-xt-ink'}`}>{l}</button>
            ))}
          </div>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {list.map((r, i) => (
              <li key={r.name + i} className="flex flex-col gap-2 rounded-2xl bg-white p-4">
                <Stars n={r.rating} />
                <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed">{r.comment}</p>
                <span className="text-[13px] font-bold text-xt-mute">{r.name} · {r.property} · {r.source} · {r.date}</span>
                {r.ownerReply && <p className="m-0 rounded-xl bg-xt-cream p-3 text-[13px]"><b>Reply:</b> {r.ownerReply}</p>}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}
