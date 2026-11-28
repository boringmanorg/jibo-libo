import { describe, expect, it } from 'vitest';
import { directionsHref, isGoogleMapsLink, pinFromMapsLink } from '@/property/propertySetup';

describe('property Google Maps link (no paid lookups)', () => {
  it('accepts only https Google Maps links', () => {
    expect(isGoogleMapsLink('https://maps.app.goo.gl/abc123')).toBe(true);
    expect(isGoogleMapsLink('https://maps.google.com/maps?cid=8608608996389917352')).toBe(true);
    expect(isGoogleMapsLink('https://www.google.com/search?q=x')).toBe(false);
    expect(isGoogleMapsLink('https://evil.example/maps')).toBe(false);
    expect(isGoogleMapsLink('javascript:alert(1)')).toBe(false);
  });
  it('reads the pin from a full link', () => {
    expect(pinFromMapsLink('https://www.google.com/maps/place/X/@25.6025457,91.9448902,17z')).toEqual({ lat: 25.6025457, lng: 91.9448902 });
    expect(pinFromMapsLink('https://maps.app.goo.gl/abc123')).toBeNull();
  });
  it('sends guests to the saved link first, then the pin', () => {
    expect(directionsHref({ googleMapsUri: 'https://maps.app.goo.gl/abc', latitude: 1, longitude: 2, address: '' })).toBe('https://maps.app.goo.gl/abc');
    expect(directionsHref({ googleMapsUri: null, latitude: 25.6, longitude: 91.9, address: '' })).toBe('https://www.google.com/maps/search/?api=1&query=25.6,91.9');
  });
});
