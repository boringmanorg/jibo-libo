import { describe, expect, it } from 'vitest';
import { BRAND, aboutXTSYGroupSection, PROPERTY_ADDRESS } from '../src/data/brandFacts';
import { meghalayaDestinations, getDestinationImages } from '../src/data/meghalayaDestinations';
import { reviewedPhoto } from '../src/data/tourPhotos';

describe('Owner company corrections, 14 November 2026', () => {
  it('uses the company incorporation date supplied by the owner', () => {
    expect(BRAND.incorporationDate).toBe('2026-09-29');
  });
  it('keeps the company base distinct from the guest property', () => {
    expect(BRAND.hqCity).toBe('Coimbatore');
    expect(BRAND.hqState).toBe('Tamil Nadu');
    expect(PROPERTY_ADDRESS).toContain('New Shillong Township');
  });
  it('removes the inactive registration from shared company data', () => {
    expect(Object.keys(BRAND)).not.toContain('gstin');
  });
  it('includes both core domains and franchise/SaaS business scope', () => {
    expect(BRAND.coreDomains).toEqual(['https://xtsy.one', 'https://www.posbyxtsy.club']);
    const section = aboutXTSYGroupSection();
    expect(section.content).toContain('franchise');
    expect(section.content).toContain('SaaS');
  });
});

describe('Missing photo coverage', () => {
  it('returns a regional Meghalaya photo for Kynrem instead of a placeholder', () => {
    const images = getDestinationImages('kynrem-falls');
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].src).not.toContain('placeholder');
    expect(images[0].alt).toContain('regional scene');
  });
  it('covers every named destination without claiming regional photos show the landmark', () => {
    expect(meghalayaDestinations.length).toBeGreaterThan(40);
    for (const d of meghalayaDestinations) {
      const images = getDestinationImages(d.slug);
      expect(images.length, d.slug).toBeGreaterThan(0);
      expect(images.every(i => Boolean(i.src) && !i.src.includes('placeholder')), d.slug).toBe(true);
    }
  });
  it('covers all eight formerly empty tour cards', () => {
    for (const id of [704, 74, 77, 93, 65, 67, 86, 90]) expect(reviewedPhoto(`tour-${id}`)).toBeTruthy();
  });
});