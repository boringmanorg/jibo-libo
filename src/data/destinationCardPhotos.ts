import { getDestinationImages } from './meghalayaDestinations';
import { regionalDestinationPhoto } from './relevantTravelPhotos';
import { PEXELS_MEGHALAYA } from './meghalayaPhotos';

/** Cards retain the gallery selection; regional backups never claim to show the attraction. */
export function destinationCardPhotos(slug: string, name: string) {
  const regional = regionalDestinationPhoto(slug);
  const primary = getDestinationImages(slug, 1)[0] ?? regional;
  const fallback = primary.src === regional.src
    ? { src: primary.src === PEXELS_MEGHALAYA.windingRoad ? PEXELS_MEGHALAYA.hills : PEXELS_MEGHALAYA.windingRoad, alt: 'Meghalaya landscape; regional scene, not a photograph of the named attraction' }
    : regional;
  return {
    primary,
    fallback,
    caption: primary.alt.includes('regional scene') ? 'Meghalaya landscape · regional photo' : name,
    fallbackCaption: 'Meghalaya landscape · regional photo',
  };
}