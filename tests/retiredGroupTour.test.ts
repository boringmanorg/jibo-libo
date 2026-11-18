import { describe, expect, it } from 'vitest';
import { SIGNATURE_PACKAGES, getSignaturePackageBySlug } from '../src/data/signaturePackages';

describe('Retired Saturday group departure', () => {
  it('is not an available catalogue offer', () => {
    expect(getSignaturePackageBySlug('meghalaya-group-trip-6n-7d')).toBeUndefined();
    expect(SIGNATURE_PACKAGES.some((p) => p.slug === 'meghalaya-group-trip-6n-7d')).toBe(false);
  });

  // What this guards is that the seven-day Meghalaya tour is still the PRIVATE
  // package and did not quietly inherit the retired Saturday departure's shape:
  // it keeps a minimum group and has no fixed departure dates.
  //
  // Owner instruction, 16 Nov 2026: Meghalaya private tours cost Rs 2,400
  // per person per day, minimum four guests. Seven days therefore cost Rs 16,800.
  // Keep the concrete total so an accidental catalogue price change fails.
  it('preserves the private seven-day package, and its owner-set rate', () => {
    const tour = getSignaturePackageBySlug('6n-7d-meghalaya-tour');
    expect(tour?.pricePerPerson).toBe(16800);
    expect(tour?.days).toBe(7);
    expect(tour?.minGroup).toBe(4);
    expect(tour?.departures).toBeUndefined();
  });
});