import { describe, expect, it } from 'vitest';
import { RENTAL_PLATE_PHOTOS } from '@/data/rentalPlatePhotos';
import { SITE_PHOTOS } from '@/data/sitePhotos';
import { responsiveImage } from '@/data/cdnImages';
import { creditFor } from '@/data/photoCredits';

const edited = ['car-ignis', 'car-swift', 'car-baleno', 'car-i20', 'car-punch', 'car-ertiga', 'car-innova-crysta', 'bike-himalayan-450'];

describe('rental plate privacy', () => {
  it.each(edited)('%s serves only redacted variants in both formats and retains attribution', (key) => {
    const photo = SITE_PHOTOS[key];
    const variants = RENTAL_PLATE_PHOTOS[key];
    if (!photo || !variants) throw new Error(`Missing redacted variants: ${key}`);
    expect(photo.srcs).toEqual(variants.srcs);
    expect(photo.srcs.map(([width]) => width)).toEqual([480, 640, 828, 1280]);
    expect(photo.avifSrcs?.map(([width]) => width)).toEqual([480, 640, 828, 1280]);
    for (const [, src] of photo.srcs) {
      expect(src).toContain('plates-blurred-');
      const resolved = responsiveImage(src);
      expect(resolved?.srcSet).toContain('plates-blurred-480.webp');
      expect(resolved?.avifSrcSet).toContain('plates-blurred-480.avif');
      expect(resolved?.srcSet).not.toContain('/img/sp/');
      expect(creditFor(src)?.by).toBe(photo.by);
    }
  });
});