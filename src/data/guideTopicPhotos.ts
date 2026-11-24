import { IMG, COVERS, first } from './v2Images';
import { PEXELS_MEGHALAYA as PX } from './meghalayaPhotos';
import { RENTAL_VEHICLE_PHOTO } from './relevantTravelPhotos';
import { SITE_PHOTOS } from './sitePhotos';

export type GuideTopicPhoto = { src: string; alt: string; caption: string };
const regional: GuideTopicPhoto = { src: PX.hills, alt: 'Meghalaya hill landscape, a regional planning illustration', caption: 'Meghalaya landscape · regional photo' };
const property = (src: string, subject: string): GuideTopicPhoto => ({ src, alt: `${subject} at XTSY Travellers Hostel in New Shillong Township`, caption: 'XTSY Travellers Hostel · New Shillong' });
const scene = (src: string, subject: string): GuideTopicPhoto => ({ src, alt: subject, caption: `${subject} · travel illustration` });

const TOPICS: Record<string, GuideTopicPhoto> = {
  'Travel guides': regional,
  'Food & dining': { src: first(IMG.bistro), alt: 'TAB Bistro at XTSY in New Shillong Township', caption: 'TAB Bistro · New Shillong' },
  'Themed trips': scene(PX.rootBridge, 'Living root bridge in Meghalaya'),
  Itineraries: scene(PX.windingRoad, 'Meghalaya road journey'),
  'Seasonal guides': scene(PX.monsoonMist, 'Seven Sisters Falls in Meghalaya'),
  'Group trips': property(COVERS.groups, 'Shared guest space'),
  Hostels: property(first(IMG.mixedDorm) || COVERS.home, 'Dorm accommodation'),
  Stays: property(COVERS.home, 'Guest property'),
  'Tour packages': scene(PX.dawkiBoat, 'Dawki river in Meghalaya'),
  Destinations: scene(PX.mawphanlur, 'Laitlum landscape in Meghalaya'),
  Attractions: scene(PX.nohkalikai, 'Nohkalikai Falls in Meghalaya'),
  Activities: scene(PX.krangShuri, 'Krang Suri Falls in Meghalaya'),
  Glamping: { src: first(IMG.suite), alt: 'Experience by XTSY glass suite in New Shillong', caption: 'Experience by XTSY · New Shillong' },
  Hotels: regional,
  Homestays: regional,
  Rentals: { ...RENTAL_VEHICLE_PHOTO, caption: 'Rental vehicle · fleet photo' },
  'Road & bike trips': scene(IMG.bumla, 'Bumla Pass bike expedition'),
  Transport: scene(PX.windingRoad, 'Meghalaya road journey'),
  Workation: property(COVERS.workation, 'Workation space'),
  'Weddings & events': { src: COVERS.wedding, alt: 'Experience by XTSY suite, an event-planning illustration', caption: 'Experience by XTSY · venue illustration' },
  Events: scene(PX.umiamBoats, 'Umiam Lake in Meghalaya'),
  'Corporate offsites': property(COVERS.commonRoom, 'Shared guest space'),
  'Stays near hospitals': property(COVERS.contact, 'Guest property'),
  'Hostel comparison': property(COVERS.commonRoom, 'Shared guest space'),
  'Travel agency': scene(IMG.sikkim, 'Sikkim landscape'),
  'XTSY pages': property(COVERS.home, 'Guest property'),
};

export function guideTopicPhoto(topic: string): GuideTopicPhoto {
  return TOPICS[topic] ?? regional;
}

export function guideTopicBackup(photo: GuideTopicPhoto): GuideTopicPhoto {
  if (photo.caption.startsWith('TAB Bistro')) {
    const src = IMG.bistro.find((candidate) => candidate !== photo.src);
    if (src) return { src, alt: 'TAB Bistro at XTSY in New Shillong Township', caption: 'TAB Bistro · New Shillong' };
  }
  if (photo.caption.startsWith('XTSY Travellers Hostel')) {
    const src = photo.src === COVERS.home ? COVERS.about : COVERS.home;
    return property(src, 'Guest property');
  }
  if (photo.caption.startsWith('Experience by XTSY')) {
    const src = IMG.suite.find((candidate) => candidate !== photo.src);
    if (src) return { src, alt: 'Experience by XTSY glass suite in New Shillong', caption: 'Experience by XTSY · New Shillong' };
  }
  if (photo.caption.startsWith('Rental vehicle')) {
    const vehicle = SITE_PHOTOS['car-innova-crysta'];
    const src = vehicle?.srcs.find(([width]) => width >= 1280)?.[1];
    if (src && src !== photo.src && vehicle) return { src, alt: vehicle.alt, caption: 'Rental vehicle · fleet photo' };
  }
  return photo.src === regional.src
    ? scene(PX.windingRoad, 'Meghalaya road landscape')
    : regional;
}