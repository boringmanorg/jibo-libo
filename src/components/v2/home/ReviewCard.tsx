import type React from 'react';
import { Button } from '@/components/ui/button';

export type R = { reviewId?: string; name: string; rating: number; ratingScale?: number; comment: string; date: string; property: string; source: string; ownerReply?: string };

export const Stars = ({ n, scale = 5 }: { n: number; scale?: number }) => (
  scale === 5 ? <span aria-label={`${n} out of 5 stars`} className="text-xt-crimson">{'★'.repeat(Math.max(0, Math.min(5, Math.round(n))))}<span className="text-xt-line">{'★'.repeat(5 - Math.max(0, Math.min(5, Math.round(n))))}</span></span> : <span aria-label={`${n} out of ${scale}`} className="font-bold text-xt-crimson">{n}/{scale}</span>
);

export function Card({ r, onOpen, className = '', style }: { r: R; onOpen: () => void; className?: string; style?: React.CSSProperties }) {
  return (
    <Button variant="ghost" type="button" onClick={onOpen} style={style}
      className={`flex min-h-12 relative h-full w-[260px] sm:w-full flex-col items-start whitespace-normal gap-3 rounded-3xl border border-xt-line/60 bg-xt-paper p-5 pt-6 text-left text-xt-ink transition-transform hover:-translate-y-1 hover:bg-xt-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-xt-crimson ${className}`}>
      <span aria-hidden className="xt-display absolute right-5 top-2 text-[56px] leading-none text-xt-crimson/20">&ldquo;</span>
      <Stars n={r.rating} scale={r.ratingScale} />
      <span className="line-clamp-5 flex-1 whitespace-pre-line text-[15px] leading-relaxed">{r.comment}</span>
      <span className="border-t border-xt-line/60 pt-3 text-[13px] font-bold text-xt-mute">{r.name} · {r.property === 'TAB Bistro by XTSY' ? 'TAB Bistro' : r.property === 'Experience by XTSY' ? 'Glass suite' : 'Hostel'} · {r.source}</span>
    </Button>
  );
}

