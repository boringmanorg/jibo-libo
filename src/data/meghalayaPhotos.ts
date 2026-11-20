/**
 * Meghalaya scenes used by guides and SEO pages. All are credited photographs: XTSY Voyage's own,
 * or a reviewed Pexels photo with its photographer credited (src/data/photoCredits.ts).
 * (Until 21 Nov 2026 these were uncredited files stored on Lovable; replaced at the owner's request
 * for real, credited images only.)
 */
import { IMG } from './v2Images';
import { PEXELS_PHOTOS } from './pexelsPhotos';

const px = (key: string, fallback: string) => PEXELS_PHOTOS[key]?.srcs.find(([w]) => w >= 1280)?.[1] ?? fallback;

export const PEXELS_MEGHALAYA = {
  hills: IMG.meghalaya,
  rootBridge: IMG.rootBridge,
  windingRoad: px('exp-meghalaya-loop', IMG.laitlum),
  monsoonMist: IMG.sevenSisters,
  umiamBoats: IMG.umiam,
  dawkiBoat: IMG.dawki,
  mawphanlur: IMG.laitlum,
  nohkalikai: IMG.nohkalikai,
  krangShuri: IMG.krangSuri,
  khasiLake: IMG.umiam,
};
