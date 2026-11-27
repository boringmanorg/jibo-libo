import type { PlatformLogo } from '@/data/platformLogos';
import { cn } from '@/lib/utils';

/** Row of platform logos; only logos that carry a verified href are links, the rest are static marks. */
export function PlatformLogoStrip({ logos, size = 32, label, className, showNames = false, compact = false }: { logos: PlatformLogo[]; size?: number; label?: string; className?: string; showNames?: boolean; compact?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {label && <span className={cn('text-xs font-bold uppercase tracking-[0.14em] opacity-80', compact && 'basis-full sm:basis-auto')}>{label}</span>}
      <ul className={cn('m-0 flex list-none flex-wrap items-center p-0', compact ? 'gap-3' : 'gap-2.5')}>
        {logos.map((l) => {
          // A fixed box (not width: auto): the row is laid out the same before, during and after the
          // logos load, whatever the files' own proportions, so the hero never jumps (layout shift).
          const w = Math.round(size * l.ratio);
          const img = <img src={l.src} alt={showNames ? '' : l.name} width={w} height={size} loading="lazy" decoding="async" className="block shrink-0 overflow-hidden rounded-md object-contain" style={{ height: size, width: w }} />;
          const inner = <>{img}{showNames && <span className="text-sm font-semibold">{l.name}</span>}</>;
          const cls = cn('flex min-h-12 items-center justify-center gap-2 rounded-lg', !compact && 'min-w-12');
          return (
            <li key={l.name}>
              {l.href
                ? <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`XTSY on ${l.name}`} className={cn(cls, 'transition-opacity hover:opacity-80')}>{inner}</a>
                : <span className={cls} title={l.name}>{inner}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
