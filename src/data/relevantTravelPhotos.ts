/**
 * Credited photos for tours, rentals and destination guides that have no photo of their own.
 * TRAVEL_PHOTOS / RENTAL_VEHICLE_PHOTO come from the reviewed site-photo set (Wikimedia Commons and
 * Pexels, credited on the page); an entry is simply absent until its photo has been reviewed.
 * (The earlier uncredited files stored on Lovable were removed on 21 Nov 2026.)
 */
import { PEXELS_MEGHALAYA } from './meghalayaPhotos';
import { SITE_PHOTOS } from './sitePhotos';

const site = (key: string) => {
  const p = SITE_PHOTOS[key];
  return p ? { src: p.srcs.find(([w]) => w >= 1280)?.[1] ?? p.srcs[p.srcs.length - 1][1], alt: p.alt } : null;
};

/** A photo of one of the fleet's cars; '' until reviewed. */
export const RENTAL_VEHICLE_PHOTO = site('car-ertiga') ?? site('car-innova-crysta') ?? { src: '', alt: 'XTSY self-drive rental car' };

export const TRAVEL_PHOTOS: Record<string, { src: string; alt: string }> = Object.fromEntries(
  ['tour-74', 'tour-75', 'tour-76', 'tour-77', 'tour-93', 'tour-65', 'tour-67', 'tour-66', 'tour-85', 'tour-86', 'tour-87', 'tour-90', 'tour-91', 'tour-92', 'tour-704', 'tour-204', 'tour-7', 'sig-5d-meghalaya-trip-package']
    .flatMap((k) => { const p = site(k); return p ? [[k, p]] : []; }),
);

export function regionalDestinationPhoto(slug: string): { src: string; alt: string } {
  if (/sohra|kynrem|dainthlen|wei-sawdong|garden-of-caves|arwah|mawmluh/.test(slug))
    return { src: PEXELS_MEGHALAYA.hills, alt: 'Khasi Hills landscape in Meghalaya; regional scene, not a photograph of the named attraction' };
  if (/nongkhnum|mawthadraishan|ranikor|jakrem/.test(slug))
    return { src: PEXELS_MEGHALAYA.windingRoad, alt: 'Meghalaya hills and valleys; regional scene, not a photograph of the named attraction' };
  return { src: PEXELS_MEGHALAYA.hills, alt: 'Meghalaya hill landscape; regional scene, not a photograph of the named attraction' };
}