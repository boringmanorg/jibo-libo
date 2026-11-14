/**
 * Picks a real XTSY / XTSY Voyage photo that matches a tour or place by
 * keyword. Returns '' when nothing relevant exists, so the UI shows a branded
 * placeholder instead of an unrelated or AI-generated image.
 */
import { IMG, first } from './v2Images';
import { TRAVEL_PHOTOS } from './relevantTravelPhotos';

const RULES: [RegExp, string][] = [
  [/winter spiti|spiti snow/i, TRAVEL_PHOTOS['tour-67'].src],
  [/spiti|kinnaur/i, TRAVEL_PHOTOS['tour-65'].src],
  [/munnar|eravikulam/i, TRAVEL_PHOTOS['tour-74'].src],
  [/varkala|kovalam/i, TRAVEL_PHOTOS['tour-77'].src],
  [/ooty|coonoor|nilgiri/i, TRAVEL_PHOTOS['tour-86'].src],
  [/guruvayur|padmanabhaswamy|kerala temple/i, TRAVEL_PHOTOS['tour-93'].src],
  [/madurai|rameswaram|kanyakumari/i, TRAVEL_PHOTOS['tour-90'].src],
  [/seven sister/i, IMG.sevenSisters],
  [/xtsy 270|experience by xtsy|glass|stargaz|honeymoon cloud|romantic/i, first(IMG.suite)],
  [/dawki|umngot|shnongpdeng/i, IMG.dawki],
  [/root bridge|nongriat/i, IMG.rootBridge],
  [/nohkalikai|cherrapunji|cherrapunjee|sohra/i, IMG.nohkalikai],
  [/krang suri|krang shuri|jaintia/i, IMG.krangSuri],
  [/mawlynnong/i, IMG.mawlynnong],
  [/mawsmai|cave|krem/i, IMG.mawsmai],
  [/laitlum/i, IMG.laitlum],
  [/umiam/i, IMG.umiam],
  [/elephant falls/i, IMG.elephant],
  [/bumla|bike|motorbike|royal enfield/i, IMG.bumla],
  [/tawang|arunachal|sela|bomdila|dirang/i, IMG.arunachal],
  [/kaziranga|assam|guwahati/i, IMG.assam],
  [/nagaland|kohima|dzukou|hornbill/i, IMG.nagaland],
  [/sikkim|pelling|gangtok|kanchenjunga/i, IMG.sikkim],
  [/waterfall|meghalaya|shillong|wari chora/i, IMG.meghalaya],
];

const ok = (src: string) => Boolean(src) && !src.endsWith('placeholder.svg');

/**
 * The first text (usually the title) decides the photo when it matches a rule.
 * Otherwise the photo comes from the other texts, rotating between the matches
 * so a row of similar packages doesn't repeat one image.
 */
export function photoFor(...texts: (string | undefined)[]): string {
  const [title = '', ...rest] = texts;
  const specific = RULES.slice(0, -1);
  const generic = RULES[RULES.length - 1];
  for (const [re, src] of specific) if (re.test(title) && ok(src)) return src;
  const s = rest.filter(Boolean).join(' ');
  const hits = specific.filter(([re, src]) => re.test(s) && ok(src)).map(([, src]) => src);
  const unique = [...new Set(hits)];
  if (!unique.length) return generic[0].test(`${title} ${s}`) && ok(generic[1]) ? generic[1] : '';
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return unique[h % Math.min(unique.length, 3)];
}
