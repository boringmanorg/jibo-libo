import { destinationPath } from '@/data/neTaxonomy';
import { useState } from 'react';
import { Link } from '@/lib/router-compat';
import { MapPin, ArrowRight } from 'lucide-react';
import { getDestinationImages, type MeghalayaDestination } from '@/data/meghalayaDestinations';
import { regionalDestinationPhoto } from '@/data/relevantTravelPhotos';
import { Photo } from '@/components/v2/primitives';

interface DestinationCardProps {
  destination: MeghalayaDestination;
  className?: string;
}

const DestinationCard = ({ destination, className = '' }: DestinationCardProps) => {
  const photo = getDestinationImages(destination.slug)[0] ?? regionalDestinationPhoto(destination.slug);
  const fallback = regionalDestinationPhoto(destination.slug);
  const [substituted, setSubstituted] = useState(false);
  const regional = substituted || photo.alt.includes('regional scene');

  return (
    <Link
      to={destinationPath(destination.slug)}
      className={`group block rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg ${className}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Photo
          key={destination.slug}
          src={photo.src}
          alt={photo.alt}
          fallbackSrc={fallback.src}
          fallbackAlt={fallback.alt}
          onFallback={() => setSubstituted(true)}
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium capitalize text-foreground">
          {destination.category}
        </span>
        {regional && <span className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 text-xs text-foreground">Meghalaya landscape · regional photo</span>}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {destination.name}
        </h3>
        <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>{destination.region}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {destination.shortDescription}
        </p>
        <div className="mt-3 flex items-center text-sm font-medium text-primary">
          Explore
          <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
};

export default DestinationCard;