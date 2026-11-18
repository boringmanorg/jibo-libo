import { describe, expect, it } from 'vitest';
import { getTourCatalogueStats } from '../src/data/tourCatalogueStats';

describe('tour card total', () => {
  it('counts all 74 domestic and international cards displayed on /tours', () => {
    expect(getTourCatalogueStats()).toEqual({ total: 74, domestic: 64, international: 10 });
  });
});