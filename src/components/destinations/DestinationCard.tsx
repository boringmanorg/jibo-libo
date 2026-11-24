import { destinationPath } from '@/data/neTaxonomy';
import { Link } from '@/lib/router-compat';
import { MapPin, ArrowRight } from 'lucide-react';
import { type MeghalayaDestination } from '@/data/meghalayaDestinations';
import { DestinationCardPhoto } from '@/components/v2/TravelCardPhoto';

interface DestinationCardProps {
  destination: MeghalayaDestination;
  className?: string;
}

const DestinationCard = ({ destination, className = '' }: DestinationCardProps) => {

  return (
    <Link
      to={destinationPath(destination.slug)}
      className={`group block rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg ${className}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <DestinationCardPhoto
          key={destination.slug}
          slug={destination.slug}
          name={destination.name}
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium capitalize text-foreground">
          {destination.category}
        </span>
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