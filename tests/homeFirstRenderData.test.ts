import { describe, it, expect } from 'vitest';
import { TOUR_CATALOGUE_TOTAL } from '@/data/tourCatalogueCount';
import { getTourCatalogueStats } from '@/data/tourCatalogueStats';
import { HOME_FEATURED_REVIEWS } from '@/data/homeFeaturedReviews';
import { pickFloating, defaultReviews } from '@/components/v2/home/HomeReviews';

describe('homepage saved first-render data', () => {
  it('tour count matches both /tours catalogues', () => {
    expect(TOUR_CATALOGUE_TOTAL).toBe(getTourCatalogueStats().total);
  });
  it('eight saved review cards match the live review feed selection', () => {
    expect(HOME_FEATURED_REVIEWS).toEqual(pickFloating(defaultReviews()));
    expect(HOME_FEATURED_REVIEWS).toHaveLength(8);
  });
});
