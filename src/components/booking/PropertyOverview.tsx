import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { MapPin } from 'lucide-react';
import { logoFor } from '@/data/platformLogos';
import { getPublicPropertyProfileFn } from '@/property/propertySetup.functions';
import { directionsHref } from '@/property/propertySetup';
import { GOOGLE_RATING } from '@/data/brandFacts';
import { hostelPlatformScores } from '@/data/hostelPlatformScores';

type Id = 'XTSY-SHL-HOSTEL' | 'XTSY-SHN-CAMP';

export function usePublicPropertyProfile(propertyId: Id) {
  const get = useServerFn(getPublicPropertyProfileFn);
  return useQuery({ queryKey: ['public-property', propertyId], queryFn: () => get({ data: { propertyId } }), staleTime: 60_000 });
}

/** Property facts saved in the console's Property setup. Platform logos are presence markers, never links. */
export default function PropertyOverview({ propertyId }: { propertyId: Id }) {
  const { data: p } = usePublicPropertyProfile(propertyId);
  if (!p) return null;
  // Approved hostel scores only (brandFacts / platform snapshot); each keeps its own scale, never blended.
  const scores: Record<string, { value: string; scale: number; note?: string }> | null = propertyId === 'XTSY-SHL-HOSTEL'
    ? { Google: { value: GOOGLE_RATING.value, scale: 5, note: `${GOOGLE_RATING.count} reviews` }, ...Object.fromEntries(hostelPlatformScores.map((x) => [x.platform, { value: x.value, scale: x.scale, ...(x.platform === 'Booking.com' ? { note: 'Earlier score' } : x.platform === 'Expedia' ? { note: '1 review' } : {}) }])) }
    : null;
  return (
    <section aria-label="About this property" className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{p.propertyType}</p>
          <h2 className="font-display text-2xl sm:text-3xl">{p.displayName}</h2>
          {p.address && <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{p.address}</p>}
          {directionsHref(p) && <a href={directionsHref(p)!} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-[48px] items-center text-sm font-medium text-primary underline">Open in Google Maps</a>}
        </div>
        {p.googleRating !== null && (
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold">{p.googleRating.toFixed(1)}★</p>
            <p className="text-xs text-muted-foreground">{p.googleReviewCount ?? 0} Google reviews</p>
          </div>
        )}
      </div>
      {p.description && <p className="text-sm leading-relaxed">{p.description}</p>}
      {p.amenities.length > 0 && (
        <ul className="flex flex-wrap gap-2">{p.amenities.map((a) => <li key={a} className="rounded-full bg-muted px-3 py-1 text-sm">{a}</li>)}</ul>
      )}
      {p.googleReviews.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...p.googleReviews].sort((a, b) => b.rating - a.rating).slice(0, 4).map((r, i) => (
            <figure key={i} className="rounded-xl border border-border p-4 text-sm">
              <p aria-label={`${r.rating} out of 5`} className="text-amber-500">{'★'.repeat(Math.round(r.rating))}</p>
              <blockquote className="mt-1 line-clamp-5">{r.text}</blockquote>
              <figcaption className="mt-2 text-xs text-muted-foreground">{r.author} · Google{r.when ? ` · ${r.when}` : ''}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {p.otaPresence.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{scores ? 'Guest ratings' : 'Also listed on'}</p>
          <ul className="flex flex-wrap items-center gap-3">
            {p.otaPresence.map((o) => {
              const l = logoFor(o);
              const s = scores?.[o];
              return (
                <li key={o} className={s ? 'flex min-h-[48px] items-center gap-2 rounded-xl border border-border px-3 py-1.5' : ''}>
                  {l ? <img src={l.src} alt={o} title={o} width={32} height={32} loading="lazy" className="h-8 w-8 object-contain" /> : <span className="text-sm">{o}</span>}
                  {s && <span className="leading-tight"><span className="block text-base font-semibold">{s.value}<span className="text-xs font-normal text-muted-foreground">/{s.scale}</span></span>{s.note && <span className="block text-xs text-muted-foreground">{s.note}</span>}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
