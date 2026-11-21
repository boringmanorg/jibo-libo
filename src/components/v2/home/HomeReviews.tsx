/**
 * Homepage guest reviews: floating review cards around a centred headline
 * (testimonial template), a review pop-up for each card, and a full list of
 * every saved review. Review text is verbatim from the review data modules.
 */
import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { featuredBistroReviews } from '@/data/featuredGoogleReviews';
import { hostelGoogleReviewSnapshot } from '@/data/hostelGoogleReviewSnapshot';
import { bistroGoogleReviews } from '@/data/bistroGoogleReviews';
import { hostelOtaReviews } from '@/data/hostelOtaReviews';
import { GOOGLE_RATING, BISTRO_GOOGLE_RATING } from '@/data/brandFacts';
import { PlatformScores } from '@/components/reviews/PlatformScores';
import { Button } from '@/components/ui/button';

export type { R } from './ReviewCard';
import { Stars, Card, type R } from './ReviewCard';

function allReviews(): R[] {
  const seen = new Set<string>();
  const out: R[] = [];
  const add = (r: Omit<R, 'source'> & { source?: string }) => {
    const key = r.reviewId ?? `${r.property}|${r.source ?? 'Google'}|${r.name}|${r.comment.replace(/\s+/g, ' ').slice(0, 40)}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...r, property: r.property || 'XTSY Travellers Hostel', source: r.source ?? 'Google' });
  };
  [...hostelGoogleReviewSnapshot.reviews, ...bistroGoogleReviews, ...hostelOtaReviews, ...featuredBistroReviews].forEach(add);
  return out;
}

// Desktop layout from the testimonial template: review cards in two
// staggered columns on each side of the centred headline.
const SPOTS: { side: 'left' | 'right'; x: number; t: number; r: number }[] = [
  { side: 'left', x: 1, t: 3, r: -3 }, { side: 'right', x: 1, t: 5, r: 3 }, { side: 'left', x: 11, t: 28, r: 2 }, { side: 'right', x: 11, t: 30, r: -2 },
  { side: 'left', x: 1, t: 54, r: 3 }, { side: 'right', x: 1, t: 56, r: -3 }, { side: 'left', x: 11, t: 78, r: -2 }, { side: 'right', x: 11, t: 79, r: 2 },
]

/** Picks the eight showcase cards; the homepage uses a saved copy (homeFeaturedReviews). */
export function pickFloating(reviews: R[], match?: RegExp, bistro?: boolean): R[] {
    const good = reviews.filter((r) => r.rating / (r.ratingScale ?? 5) >= 0.8 && r.comment.length > 25);
    const b = good.filter((r) => r.property === 'TAB Bistro by XTSY').sort((a, z) => Number(/food|meal|chicken|bistro|breakfast|dinner/i.test(z.comment)) - Number(/food|meal|chicken|bistro|breakfast|dinner/i.test(a.comment)));
    const h = good.filter((r) => r.property !== 'TAB Bistro by XTSY');
    const mixed = match ? (bistro ? [...b, ...h] : good) : [...h.filter((r) => r.source === 'Airbnb' && r.name !== 'Akshit').slice(0, 1), ...h.filter((r) => r.source === 'Agoda').slice(0, 1), ...h.filter((r) => r.source === 'Google').slice(0, 4), ...b.slice(0, 2), ...h];
    return mixed.slice(0, SPOTS.length);
  }

/** Every saved review for the default homepage showcase. */
export function defaultReviews(): R[] { return allReviews(); }

export type ReviewShowcaseProps = {
  /** Only reviews whose text matches this pattern (verbatim reviews, filtered by topic). */
  match?: RegExp;
  /** Include featured TAB Bistro reviews regardless of `match`. */
  bistro?: boolean;
  hostel?: boolean;
  badge?: string;
  title?: string;
  description?: string;
  /** Extra verbatim reviews shown first (e.g. Airbnb reviews for one listing). */
  extra?: R[];
  /** Render only the pop-ups (lazy-loaded from the homepage's light showcase). */
  dialogOnly?: boolean;
  initialOpen?: R | null;
  initialAll?: boolean;
};

export function Reviews({ extra = [], match, bistro, hostel, badge = 'Guest reviews', title = `${GOOGLE_RATING.value} on Google from ${GOOGLE_RATING.count} reviews`, description = 'Real words from guests of XTSY Travellers Hostel and TAB Bistro by XTSY, with hostel reviews from Airbnb and Agoda.', dialogOnly, initialOpen = null, initialAll = false }: ReviewShowcaseProps = {}) {
  const reviews = useMemo(() => {
    const all = allReviews().filter((r) => !hostel || r.property === 'XTSY Travellers Hostel');
    if (!match) return [...extra, ...all];
    return [...extra, ...all.filter((r) => (bistro && r.property === 'TAB Bistro by XTSY') || match.test(r.comment))];
  }, [match, bistro, hostel, extra]);
  const floating = useMemo(() => pickFloating(reviews, match, bistro), [reviews, match, bistro]);
  const [open, setOpen] = useState<R | null>(initialOpen);
  const [all, setAll] = useState(initialAll);
  const [tab, setTab] = useState<'all' | 'hostel' | 'bistro'>(bistro ? 'bistro' : 'all');
  const [source, setSource] = useState('All platforms');
  const list = reviews.filter((r) => (tab === 'all' || (tab === 'bistro') === (r.property === 'TAB Bistro by XTSY')) && (source === 'All platforms' || r.source === source)).sort((a, z) => z.rating / (z.ratingScale ?? 5) - a.rating / (a.ratingScale ?? 5));
  const rating = bistro ? BISTRO_GOOGLE_RATING : GOOGLE_RATING;

  const dialogs = (<>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto max-w-lg rounded-3xl bg-xt-paper text-xt-ink">
          {open && (<>
            <DialogTitle className="flex flex-col gap-1 text-[20px]">{open.name}<span className="text-[14px] font-semibold text-xt-mute">{open.property} · {open.source} · {open.date}</span></DialogTitle>
            <Stars n={open.rating} scale={open.ratingScale} />
            <DialogDescription className="whitespace-pre-line text-[16px] leading-relaxed text-xt-ink">{open.comment}</DialogDescription>
            {open.ownerReply && <p className="m-0 rounded-2xl bg-xt-cream p-4 text-[14px] leading-relaxed"><b>Reply from XTSY:</b> {open.ownerReply}</p>}
          </>)}
        </DialogContent>
      </Dialog>

      <Dialog open={all} onOpenChange={setAll}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-3xl bg-xt-paper text-xt-ink">
          <DialogTitle className="text-[22px]">{badge}</DialogTitle>
          <DialogDescription className="text-xt-mute">{bistro ? 'Google reviews from TAB Bistro by XTSY, alongside matching hostel food reviews.' : `The complete saved hostel Google feed contains ${hostelGoogleReviewSnapshot.total} reviews, including ${hostelGoogleReviewSnapshot.reviews.filter((r) => r.comment.trim()).length} written reviews and ${hostelGoogleReviewSnapshot.reviews.filter((r) => !r.comment.trim()).length} rating-only reviews. Bistro and other platforms are separate.`}</DialogDescription>
          <div className="flex flex-wrap gap-2">
            {(!match || bistro) && ([['all', 'All'], ['hostel', 'XTSY Travellers Hostel'], ['bistro', 'TAB Bistro by XTSY']] as const).map(([k, l]) => (
              <Button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`min-h-12 h-auto whitespace-normal rounded-full px-4 text-[14px] font-bold ${tab === k ? 'bg-xt-crimson text-xt-paper' : 'bg-xt-cream text-xt-ink'}`}>{l}</Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Review platforms">
            {['All platforms', ...new Set(reviews.map((r) => r.source))].map((s) => <Button key={s} variant="ghost" className={`min-h-12 border border-xt-line ${source === s ? 'bg-xt-crimson text-xt-paper hover:bg-xt-crimson/90 hover:text-xt-paper' : 'bg-xt-cream text-xt-ink hover:bg-xt-line hover:text-xt-ink'}`} aria-pressed={source === s} onClick={() => setSource(s)}>{s}</Button>)}
          </div>
          {!list.length && <p>No saved written reviews match these filters.</p>}
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {list.map((r, i) => (
              <li key={r.name + i} className="flex flex-col gap-2 rounded-2xl bg-white p-4">
                <Stars n={r.rating} scale={r.ratingScale} />
                {r.comment.trim() ? <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed">{r.comment}</p> : <p className="m-0 text-[15px] text-xt-mute">Rating only — no written comment.</p>}
                <span className="text-[13px] font-bold text-xt-mute">{r.name} · {r.property} · {r.source} · {r.date}</span>
                {r.ownerReply && <p className="m-0 rounded-xl bg-xt-cream p-3 text-[13px]"><b>Reply:</b> {r.ownerReply}</p>}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
  </>);
  if (dialogOnly) return dialogs;
  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-20 sm:px-8 lg:px-14">
      <div className="relative overflow-hidden rounded-[32px] bg-xt-night px-5 py-14 text-white sm:px-10 lg:px-14 lg:py-16">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[70%] -translate-x-1/2 rounded-full bg-xt-crimson/25 blur-3xl" />
        <div className="relative mx-auto flex max-w-[860px] flex-col items-center gap-4 text-center">
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[13px] font-bold uppercase tracking-[0.18em]">{badge}</span>
          <h2 className="xt-display m-0 text-[42px] leading-[0.95] sm:text-[64px] lg:text-[76px]">{title}</h2>
          <p className="m-0 max-w-[620px] text-[16px] leading-relaxed text-xt-fog sm:text-[18px]">{description}</p>
          {bistro ? <p className="m-0 font-bold text-xt-paper">{rating.value} on Google from {rating.count} reviews · TAB Bistro by XTSY</p> : !extra.length && <PlatformScores />}
          <Button type="button" onClick={() => setAll(true)} className="xt-btn mt-2 flex h-14 items-center gap-2 rounded-full bg-xt-crimson px-7 text-[16px] font-extrabold text-xt-paper hover:bg-xt-crimson/90">
            Read guest reviews <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative -mx-5 mt-12 flex snap-x gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:gap-5">
          {floating.map((r, i) => (
            <div key={r.name + i} className={`xt-review-pop shrink-0 snap-start ${i % 2 ? 'lg:translate-y-8' : ''}`} style={{ animationDelay: `${(i % 4) * 0.08}s` }}>
              <Card r={r} onOpen={() => setOpen(r)} />
            </div>
          ))}
        </div>
      </div>

      {dialogs}
    </section>
  );
}
