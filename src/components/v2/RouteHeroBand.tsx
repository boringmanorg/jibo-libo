import { useLocation } from '@tanstack/react-router';
import { Photo, PhotoCaption } from './primitives';
import { routeHero } from '@/data/routeHeroes';

/**
 * Photo band at the top of pages whose own layout has none (src/data/routeHeroes.ts), with the
 * photo credit. The page's own heading follows straight after it.
 */
export default function RouteHeroBand() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const hero = routeHero(pathname);
  if (!hero) return null;
  return (
    <figure className="xt relative m-0 h-[220px] overflow-hidden bg-xt-ink sm:h-[300px] lg:h-[360px]" data-route-hero>
      <Photo src={hero.src} alt={hero.alt} eager tone="slate" sizes="100vw" className="absolute inset-0 h-full w-full" position={hero.position} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
      <figcaption className="absolute bottom-2.5 right-3 left-3 flex justify-end text-right sm:right-6">
        <span className="max-w-full rounded-full bg-black/45 px-3 py-1 backdrop-blur-sm"><PhotoCaption src={hero.src} color="text-white" className="[&_a]:text-white" /></span>
      </figcaption>
    </figure>
  );
}
