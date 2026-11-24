import { useEffect, useState } from 'react';
import { Photo } from './primitives';
import { destinationCardPhotos } from '@/data/destinationCardPhotos';

/** Scoped to travel cards: preserve a real photo on failure and label what it actually shows. */
export function TravelCardPhoto({ src, alt, caption, fallbackSrc, fallbackAlt, fallbackCaption, className, sizes, eager }: {
  src: string;
  alt: string;
  caption: string;
  fallbackSrc: string;
  fallbackAlt: string;
  fallbackCaption: string;
  className: string;
  sizes?: string;
  eager?: boolean;
}) {
  const [substituted, setSubstituted] = useState(false);
  useEffect(() => setSubstituted(false), [src]);
  return (
    <Photo key={src} src={src} alt={alt} fallbackSrc={fallbackSrc} fallbackAlt={fallbackAlt}
      onFallback={() => setSubstituted(true)} className={className}
      {...(sizes ? { sizes } : {})} {...(eager ? { eager: true } : {})}>
      <span className="absolute inset-x-2 bottom-2 w-fit max-w-[calc(100%_-_1rem)] rounded bg-background/90 px-2 py-1 text-xs leading-snug text-foreground">
        {substituted ? fallbackCaption : caption}
      </span>
    </Photo>
  );
}

export function DestinationCardPhoto({ slug, name, className, sizes }: {
  slug: string; name: string; className: string; sizes?: string;
}) {
  const { primary, fallback, caption, fallbackCaption } = destinationCardPhotos(slug, name);
  return <TravelCardPhoto src={primary.src} alt={primary.alt} caption={caption}
    fallbackSrc={fallback.src} fallbackAlt={fallback.alt} fallbackCaption={fallbackCaption}
    className={className} {...(sizes ? { sizes } : {})} />;
}