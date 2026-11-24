import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { getDestinationImages, meghalayaDestinations } from '@/data/meghalayaDestinations';
import { regionalDestinationPhoto } from '@/data/relevantTravelPhotos';
import { reviewedPhoto } from '@/data/tourPhotos';
import { photoFor } from '@/data/v2TourImages';
import { getAllTours } from '@/data/travelData';
import { SIGNATURE_PACKAGES } from '@/data/signaturePackages';

function checkPhoto(src: string) {
  expect(src).toBeTruthy();
  expect(src).not.toContain('placeholder.svg');
  if (src.startsWith('/img/')) expect(existsSync(`public${src}`), src).toBe(true);
}

describe('requested guide and tour photo coverage', () => {
  it('every Meghalaya destination has a photo and a truthfully described regional backup', () => {
    for (const destination of meghalayaDestinations) {
      const photo = getDestinationImages(destination.slug)[0];
      expect(photo, destination.slug).toBeDefined();
      if (!photo) throw new Error(`Missing photo for ${destination.slug}`);
      checkPhoto(photo.src);
      const fallback = regionalDestinationPhoto(destination.slug);
      checkPhoto(fallback.src);
      expect(fallback.alt).toContain('regional scene, not a photograph of the named attraction');
    }
  });

  it('every tour and signature package resolves to a real photo', () => {
    for (const tour of getAllTours()) checkPhoto(reviewedPhoto(`tour-${tour.id}`) || photoFor(tour.title, tour.location));
    for (const tour of SIGNATURE_PACKAGES) checkPhoto(reviewedPhoto(`sig-${tour.slug}`) || photoFor(tour.title, tour.highlights.join(' '), tour.region));
  });
});