/** Reviewed licensed regional scenes, never claimed to show an unverified landmark. */
import { PEXELS_MEGHALAYA } from './meghalayaPhotos';
import munnar from '@/assets/travel/munnar-tea-hills.jpg.asset.json';
import varkala from '@/assets/travel/varkala-cliffs-beach.jpg.asset.json';
import temple from '@/assets/travel/kerala-temple-pond.jpg.asset.json';
import spiti from '@/assets/travel/spiti-valley.jpg.asset.json';
import train from '@/assets/travel/nilgiri-blue-train.jpg.asset.json';
import tamilTemple from '@/assets/travel/tamil-nadu-temple-street.jpg.asset.json';
import winterSpiti from '@/assets/travel/spiti-key-monastery-winter.jpg.asset.json';

export const TRAVEL_PHOTOS: Record<string, { src: string; alt: string }> = {
  'tour-74': { src: munnar.url, alt: 'Tea plantations and hills in Munnar, Kerala' },
  'tour-77': { src: varkala.url, alt: 'Varkala cliffs overlooking the beach in Kerala' },
  'tour-93': { src: temple.url, alt: 'Temple architecture beside a pond in Kerala' },
  'tour-65': { src: spiti.url, alt: 'Rugged mountains in Spiti Valley, Himachal Pradesh' },
  'tour-67': { src: winterSpiti.url, alt: 'Key Monastery in a snow-covered Spiti Valley' },
  'tour-86': { src: train.url, alt: 'Blue train at Ooty station in the Nilgiris' },
  'tour-90': { src: tamilTemple.url, alt: 'Temple street in Tamil Nadu, India' },
  'tour-704': { src: PEXELS_MEGHALAYA.hills, alt: 'Green Meghalaya hills, Northeast India' },
};

export function regionalDestinationPhoto(slug: string): { src: string; alt: string } {
  if (/sohra|kynrem|dainthlen|wei-sawdong|garden-of-caves|arwah|mawmluh/.test(slug))
    return { src: PEXELS_MEGHALAYA.hills, alt: 'Green Khasi Hills landscape in Meghalaya; regional scene, not a photograph of the named attraction' };
  if (/nongkhnum|mawthadraishan|ranikor|jakrem/.test(slug))
    return { src: PEXELS_MEGHALAYA.windingRoad, alt: 'Valleys and a winding road in the West Khasi Hills, Meghalaya; regional landscape' };
  return { src: PEXELS_MEGHALAYA.hills, alt: 'Meghalaya hill landscape; regional scene, not a photograph of the named attraction' };
}