/**
 * Browser-safe geography for programmatic guide text. Every destination resolves to its real
 * state, gateway and local highlights, so a Mizoram or Tripura page never shows Meghalaya content.
 * Facts are deliberately conservative: no fares, no invented drive times beyond well-known legs.
 */
export type RegionId = 'meghalaya' | 'assam' | 'arunachal-pradesh' | 'nagaland' | 'manipur' | 'mizoram' | 'tripura' | 'sikkim';

export interface Region {
  id: RegionId;
  state: string;
  tokens: string[];
  reach: { content: string; list: string[] };
  highlights: string[];
  guides: string;
  permit?: string;
}

export const REGIONS: Region[] = [
  {
    id: 'assam', state: 'Assam',
    tokens: ['assam', 'guwahati', 'kaziranga', 'majuli', 'kamakhya', 'sivasagar', 'jorhat', 'tezpur', 'haflong', 'dibrugarh', 'silchar'],
    reach: {
      content: 'Guwahati (GAU) is the main airport and railhead for Assam; Jorhat, Tezpur, Dibrugarh and Silchar also have airports. Upper Assam destinations are a long road or rail journey from Guwahati, so most itineraries break the trip.',
      list: ['By air: Guwahati (GAU), or Jorhat / Tezpur / Dibrugarh for Upper Assam', 'By rail: Guwahati and Kamakhya stations; Jorhat and Dibrugarh for the east', 'Majuli is reached by ferry from Nimati Ghat near Jorhat', 'XTSY arranges cabs and stays on WhatsApp'],
    },
    highlights: ['Jeep and elephant-zone safaris in Kaziranga National Park', 'Satras and mask-making on Majuli river island', 'Kamakhya Temple on Nilachal Hill, Guwahati', 'Ahom monuments of Sivasagar — Rang Ghar and Talatal Ghar', 'Tea estates around Jorhat and Dibrugarh', 'Sunset cruises on the Brahmaputra'],
    guides: 'local Assamese guides and naturalists',
  },
  {
    id: 'arunachal-pradesh', state: 'Arunachal Pradesh',
    tokens: ['arunachal', 'tawang', 'ziro', 'bomdila', 'pasighat', 'itanagar', 'dirang', 'sela'],
    reach: {
      content: 'Itanagar has Donyi Polo Airport (HGI); Tawang and Bomdila are usually reached by road from Guwahati or Tezpur over Sela Pass, a multi-day drive. Ziro is reached via Itanagar or the North Lakhimpur railhead.',
      list: ['By air: Itanagar (HGI); Tezpur or Guwahati for the Tawang route', 'By rail: Naharlagun near Itanagar; North Lakhimpur for Ziro', 'Tawang by road: Guwahati – Bomdila – Dirang – Sela Pass – Tawang, usually broken overnight', 'Inner Line Permit (Indians) or Protected Area Permit (foreigners) required'],
    },
    highlights: ['Tawang Monastery, India’s largest Buddhist monastery', 'Sela Pass and Sela Lake', 'Ziro Valley rice fields and Apatani villages', 'Bomdila and Dirang monasteries', 'Siang river landscapes around Pasighat'],
    guides: 'local Monpa, Apatani and Adi guides',
    permit: 'Inner Line Permit for Indian visitors; Protected Area Permit for foreign nationals.',
  },
  {
    id: 'nagaland', state: 'Nagaland',
    tokens: ['nagaland', 'kohima', 'dzukou', 'mon', 'mokokchung', 'khonoma', 'dimapur', 'kisama'],
    reach: {
      content: 'Dimapur has Nagaland’s airport (DMU) and main railway station; Kohima is about 75 km uphill by road. Mon and Mokokchung are long drives and usually need an overnight stop.',
      list: ['By air: Dimapur (DMU)', 'By rail: Dimapur station', 'Dimapur to Kohima by road, roughly 3 hours', 'Inner Line Permit required for Indian visitors'],
    },
    highlights: ['Kohima War Cemetery', 'Dzukou Valley trek', 'Hornbill Festival at Kisama Heritage Village (1–10 December)', 'Khonoma, the green village', 'Konyak villages around Mon'],
    guides: 'local Naga guides',
    permit: 'Inner Line Permit for Indian visitors.',
  },
  {
    id: 'manipur', state: 'Manipur',
    tokens: ['manipur', 'imphal', 'loktak', 'moreh', 'moirang', 'ukhrul'],
    reach: {
      content: 'Imphal has Bir Tikendrajit International Airport (IMF), the usual way in. Road access is via Dimapur and Kohima. Check the current travel advisory before planning.',
      list: ['By air: Imphal (IMF)', 'By rail: Dimapur or Jiribam, then road', 'By road: Dimapur – Kohima – Imphal', 'Inner Line Permit required for Indian visitors'],
    },
    highlights: ['Loktak Lake and its floating phumdis', 'Keibul Lamjao National Park, home of the sangai deer', 'Kangla Fort, Imphal', 'Ima Keithel, the women-run market', 'INA Memorial at Moirang'],
    guides: 'local Manipuri guides',
    permit: 'Inner Line Permit for Indian visitors.',
  },
  {
    id: 'mizoram', state: 'Mizoram',
    tokens: ['mizoram', 'aizawl', 'champhai', 'reiek', 'phawngpui', 'lunglei', 'zokhawthar'],
    reach: {
      content: 'Mizoram’s airport is Lengpui (AJL), about 30 km from Aizawl. Champhai lies near the Myanmar border, roughly 190 km east of Aizawl — a full day by road. Silchar in Assam is the usual rail and road connection.',
      list: ['By air: Lengpui, Aizawl (AJL)', 'By rail: Silchar (Assam), then road to Aizawl', 'Aizawl to Champhai by road: about 190 km, a full day', 'Inner Line Permit required for Indian visitors'],
    },
    highlights: ['Champhai valley paddy fields and vineyards', 'Murlen National Park near Champhai', 'Zokhawthar on the India–Myanmar border', 'Reiek Tlang and its heritage Mizo village', 'Aizawl ridge viewpoints and Solomon’s Temple', 'Phawngpui, the Blue Mountain'],
    guides: 'local Mizo guides',
    permit: 'Inner Line Permit for Indian visitors.',
  },
  {
    id: 'tripura', state: 'Tripura',
    tokens: ['tripura', 'agartala', 'unakoti', 'neermahal', 'melaghar', 'jampui', 'udaipur', 'kailashahar'],
    reach: {
      content: 'Agartala has Maharaja Bir Bikram Airport (IXA) and a railway station. Unakoti is in north Tripura near Kailashahar, about 4 hours by road from Agartala; Kumarghat is the nearest railhead.',
      list: ['By air: Agartala (IXA)', 'By rail: Agartala; Kumarghat for Unakoti', 'Agartala to Unakoti by road: about 4 hours', 'No inner-line permit needed for Indian visitors'],
    },
    highlights: ['Unakoti hillside rock-cut Shaiva carvings (around 7th–9th century)', 'Neermahal water palace on Rudrasagar Lake', 'Ujjayanta Palace, Agartala', 'Tripura Sundari Temple, Udaipur', 'Jampui Hills', 'Sepahijala Wildlife Sanctuary'],
    guides: 'local Tripuri and Bengali guides',
  },
  {
    id: 'sikkim', state: 'Sikkim',
    tokens: ['sikkim', 'gangtok', 'pelling', 'lachung', 'tsomgo', 'yumthang', 'nathula'],
    reach: {
      content: 'Most travellers fly into Bagdogra (IXB) or take the train to New Jalpaiguri (NJP), then drive about 4–5 hours to Gangtok. Pakyong Airport (PYG) has limited flights. North Sikkim and Tsomgo Lake need permits.',
      list: ['By air: Bagdogra (IXB); Pakyong (PYG) has limited flights', 'By rail: New Jalpaiguri (NJP)', 'NJP / Bagdogra to Gangtok: about 4–5 hours by road', 'Permits needed for North Sikkim, Tsomgo Lake and Nathula'],
    },
    highlights: ['Tsomgo Lake and the Nathula road', 'Rumtek Monastery', 'Pemayangtse Monastery and views of Kanchenjunga from Pelling', 'Yumthang Valley from Lachung', 'MG Marg, Gangtok'],
    guides: 'local Sikkimese guides',
    permit: 'Protected-area permits for North Sikkim, Tsomgo Lake and Nathula.',
  },
];

/** Region for a destination slug or label; null means Meghalaya (the default content) or unknown. */
export function regionFor(destination: string): Region | null {
  const tokens = destination.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return REGIONS.find((r) => r.tokens.some((t) => tokens.includes(t))) ?? null;
}

/** Destination hub for a slug outside Meghalaya; used when retiring out-of-scope offers. */
export function regionHubFor(slug: string): string {
  const r = regionFor(slug);
  return r ? `/destinations/${r.id}` : '/destinations';
}
