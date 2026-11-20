/**
 * Who took a photo on the site, for the credit line under page heroes. Every photo the site shows
 * is either XTSY's own, a reviewed Pexels photo, or a reviewed Wikimedia Commons / Pexels photo
 * from the site-photo pipeline (scripts/images/site-photos.ts).
 */
import { PEXELS_PHOTOS } from './pexelsPhotos';
import { SITE_PHOTOS } from './sitePhotos';

export interface PhotoCredit {
  by: string;
  byUrl?: string;
  /** Where the photo comes from: "Pexels", "Wikimedia Commons", or XTSY's own. */
  source?: string;
  sourceUrl?: string;
  license?: string;
  licenseUrl?: string;
}

/** Path without width/extension, so every size of one photo maps to the same credit. */
const stem = (src: string) => src.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0].replace(/-\d+\.(webp|avif|jpe?g|png)$/i, '');

let index: Map<string, PhotoCredit> | null = null;
function build() {
  const m = new Map<string, PhotoCredit>();
  for (const p of Object.values(PEXELS_PHOTOS)) {
    const c: PhotoCredit = { by: p.photographer, byUrl: p.photographerUrl, source: 'Pexels', sourceUrl: p.pexelsUrl };
    for (const [, s] of p.srcs) m.set(stem(s), c);
  }
  for (const p of Object.values(SITE_PHOTOS)) {
    const c: PhotoCredit = p.source === 'commons'
      ? { by: p.by, byUrl: p.byUrl, source: 'Wikimedia Commons', sourceUrl: p.page, license: p.license, licenseUrl: p.licenseUrl }
      : { by: p.by, byUrl: p.byUrl, source: 'Pexels', sourceUrl: p.page };
    for (const [, s] of p.srcs) m.set(stem(s), c);
  }
  return m;
}

export function creditFor(src?: string | null): PhotoCredit | null {
  if (!src) return null;
  index ??= build();
  const hit = index.get(stem(src));
  if (hit) return hit;
  const path = stem(src);
  if (/\/img\/o\/xtsyvoyage-/.test(path)) return { by: 'XTSY Voyage' };
  if (/\/img\/o\/shnonpedeng-/.test(path)) return { by: 'Shnonpedeng Riverside Camping' };
  if (/\/img\/o\/xtsy-|\/assets\/xtsy/i.test(path)) return { by: 'XTSY Travellers Hostel' };
  return null;
}
