/**
 * Brand logos for platforms where XTSY has a real presence. Listing logos are presence markers only:
 * they are never links, so no visitor is redirected off xtsy.one from the hero or footer strips.
 * Presence/reviews only — never implies booking availability on that platform.
 */
import youtube from '@/assets/platforms/youtube-logo.webp.asset.json';
import instagram from '@/assets/platforms/instagram-logo.webp.asset.json';
import google from '@/assets/platforms/google-logo.webp.asset.json';
import tripadvisor from '@/assets/platforms/tripadvisor-logo.webp.asset.json';
import expedia from '@/assets/platforms/expedia-logo.webp.asset.json';
import makemytrip from '@/assets/platforms/makemytrip-logo.webp.asset.json';
import agoda from '@/assets/platforms/agoda-logo.webp.asset.json';
import hostelworld from '@/assets/platforms/hostelworld-logo.webp.asset.json';
import booking from '@/assets/platforms/booking-logo.webp.asset.json';
import goibibo from '@/assets/platforms/goibibo-logo-icon.webp.asset.json';
import airbnb from '@/assets/platforms/airbnb-logo-icon.webp.asset.json';

export type PlatformLogo = { name: string; src: string; ratio: number; href?: string };

export const SOCIAL_LOGOS: PlatformLogo[] = [
  { name: 'Instagram', src: instagram.url, ratio: 1, href: 'https://www.instagram.com/xtsy.one?utm_source=xtsy.one&utm_medium=referral&utm_campaign=footer' },
  { name: 'YouTube', src: youtube.url, ratio: 192 / 135, href: 'https://www.youtube.com/@voyagebyxtsy' },
];

export const LISTING_LOGOS: PlatformLogo[] = [
  { name: 'Google', src: google.url, ratio: 318 / 325 },
  { name: 'Tripadvisor', src: tripadvisor.url, ratio: 1 },
  { name: 'Booking.com', src: booking.url, ratio: 1 },
  { name: 'Hostelworld', src: hostelworld.url, ratio: 1 },
  { name: 'Expedia', src: expedia.url, ratio: 1 },
  { name: 'Agoda', src: agoda.url, ratio: 1 },
  { name: 'MakeMyTrip', src: makemytrip.url, ratio: 1 },
  { name: 'Goibibo', src: goibibo.url, ratio: 1 },
  { name: 'Airbnb', src: airbnb.url, ratio: 1 },
];

export const logoFor = (platform: string) =>
  [...LISTING_LOGOS, ...SOCIAL_LOGOS].find((l) => l.name.toLowerCase() === platform.toLowerCase());
