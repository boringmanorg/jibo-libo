/**
 * Homepage review showcase: the eight saved cards render immediately; the full
 * review feed and its pop-ups load only when a guest opens a review.
 */
import { lazy, Suspense, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GOOGLE_RATING } from '@/data/brandFacts';
import { PlatformScores } from '@/components/reviews/PlatformScores';
import { HOME_FEATURED_REVIEWS } from '@/data/homeFeaturedReviews';
import { Card, type R } from './ReviewCard';

const FullReviews = lazy(() => import('./HomeReviews').then((m) => ({ default: m.Reviews })));

export function HomeReviewsLite() {
  const [req, setReq] = useState<{ open: R | null; all: boolean; n: number } | null>(null);
  const show = (open: R | null, all: boolean) => setReq((p) => ({ open, all, n: (p?.n ?? 0) + 1 }));

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-20 sm:px-8 lg:px-14">
      <div className="relative overflow-hidden rounded-[32px] bg-xt-night px-5 py-14 text-white sm:px-10 lg:px-14 lg:py-16">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[70%] -translate-x-1/2 rounded-full bg-xt-crimson/25 blur-3xl" />
        <div className="relative mx-auto flex max-w-[860px] flex-col items-center gap-4 text-center">
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[13px] font-bold uppercase tracking-[0.18em]">Guest reviews</span>
          <h2 className="xt-display m-0 text-[42px] leading-[0.95] sm:text-[64px] lg:text-[76px]">{GOOGLE_RATING.value} on Google from {GOOGLE_RATING.count} reviews</h2>
          <p className="m-0 max-w-[620px] text-[16px] leading-relaxed text-xt-fog sm:text-[18px]">Real words from guests of XTSY Travellers Hostel and TAB Bistro by XTSY, with hostel reviews from Airbnb and Agoda.</p>
          <PlatformScores />
          <Button type="button" onClick={() => show(null, true)} className="xt-btn mt-2 flex h-14 items-center gap-2 rounded-full bg-xt-crimson px-7 text-[16px] font-extrabold text-xt-paper hover:bg-xt-crimson/90">
            Read guest reviews <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative -mx-5 mt-12 flex snap-x gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:gap-5">
          {HOME_FEATURED_REVIEWS.map((r, i) => (
            <div key={r.name + i} className={`xt-review-pop shrink-0 snap-start ${i % 2 ? 'lg:translate-y-8' : ''}`} style={{ animationDelay: `${(i % 4) * 0.08}s` }}>
              <Card r={r} onOpen={() => show(r, false)} />
            </div>
          ))}
        </div>
      </div>
      {req && (
        <Suspense fallback={null}>
          <FullReviews key={req.n} dialogOnly initialOpen={req.open} initialAll={req.all} />
        </Suspense>
      )}
    </section>
  );
}
