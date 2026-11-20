/**
 * Photos still missing on the site (owner request, 21 Nov 2026: real photographs only, credited):
 * the rental fleet by exact model, tours whose picture was not a credited photograph, destination
 * guides without one, and page heroes. Searched on Wikimedia Commons (free licences, exact models
 * and named places) and Pexels; every candidate is reviewed on a contact sheet before use.
 *
 * `match` must appear in the photo's own title/description, so a random car or waterfall is never
 * labelled as a specific model or place.
 */
export type SiteTarget = { key: string; label: string; commons: string[]; pexels?: string[]; match?: RegExp };
const t = (key: string, label: string, commons: string[], match?: RegExp, pexels?: string[]): SiteTarget => ({ key, label, commons, match, pexels });

export const SITE_TARGETS: SiteTarget[] = [
  // ── Self-drive cars (exact model) ──────────────────────────────────────
  t('car-ignis', 'Suzuki Ignis', ['Suzuki Ignis 2017', 'Maruti Suzuki Ignis', 'Suzuki Ignis'], /ignis/i),
  t('car-swift', 'Suzuki Swift', ['Maruti Suzuki Swift 2018', 'Suzuki Swift 2017', 'Maruti Swift'], /swift/i),
  t('car-baleno', 'Maruti Baleno', ['Maruti Suzuki Baleno', 'Suzuki Baleno 2016', 'Baleno 2022'], /baleno/i),
  t('car-i20', 'Hyundai i20', ['Hyundai i20 2020', 'Hyundai i20 third generation', 'Hyundai i20'], /i20/i),
  t('car-punch', 'Tata Punch', ['Tata Punch', 'Tata Punch 2021'], /punch/i),
  t('car-venue', 'Hyundai Venue', ['Hyundai Venue', 'Hyundai Venue 2019'], /venue/i),
  t('car-urban-cruiser', 'Toyota Urban Cruiser', ['Toyota Urban Cruiser 2020', 'Toyota Urban Cruiser Hyryder', 'Toyota Urban Cruiser'], /urban cruiser/i),
  t('car-sonet', 'Kia Sonet', ['Kia Sonet', 'Kia Sonet 2020'], /sonet/i),
  t('car-ertiga', 'Suzuki Ertiga', ['Suzuki Ertiga 2018', 'Maruti Suzuki Ertiga', 'Suzuki Ertiga'], /ertiga/i),
  t('car-carens', 'Kia Carens', ['Kia Carens 2022', 'Kia Carens'], /carens/i),
  t('car-innova-crysta', 'Toyota Innova Crysta', ['Toyota Innova Crysta', 'Innova Crysta'], /innova/i),
  // ── Bikes ──────────────────────────────────────────────────────────────
  t('bike-meteor-350', 'Royal Enfield Meteor 350', ['Royal Enfield Meteor 350'], /meteor/i, ['royal enfield meteor']),
  t('bike-himalayan-411', 'Royal Enfield Himalayan 411', ['Royal Enfield Himalayan 411', 'Royal Enfield Himalayan 2016', 'Royal Enfield Himalayan'], /himalayan/i, ['royal enfield himalayan']),
  t('bike-hunter-350', 'Royal Enfield Hunter 350', ['Royal Enfield Hunter 350'], /hunter/i, ['royal enfield hunter 350']),
  t('bike-himalayan-450', 'Royal Enfield Himalayan 450', ['Royal Enfield Himalayan 450', 'Himalayan 450'], /himalayan|450/i),
  // ── Tours without a credited photograph (key = tour id / package slug) ─
  t('tour-74', 'Munnar Tea Hills & Eravikulam', ['Munnar tea plantation', 'Munnar tea estate hills'], /munnar|tea/i, ['munnar tea plantation']),
  t('tour-75', 'Alleppey Houseboat & Kumarakom', ['Alappuzha houseboat backwaters', 'Kumarakom backwaters'], /alappuzha|alleppey|kumarakom|houseboat|backwater/i, ['alleppey houseboat']),
  t('tour-76', 'Classic Kerala: Kochi, Munnar, Thekkady & Alleppey', ['Chinese fishing nets Fort Kochi', 'Fort Kochi fishing nets'], /kochi|cochin|fishing net/i, ['fort kochi chinese fishing nets']),
  t('tour-77', 'Varkala Cliffs, Kovalam & Trivandrum', ['Varkala cliff beach', 'Varkala beach'], /varkala|kovalam/i, ['varkala cliff']),
  t('tour-93', 'Kerala Temple Trail', ['Padmanabhaswamy Temple', 'Guruvayur temple', 'Kerala temple architecture'], /padmanabha|guruvayur|kerala|temple/i),
  t('tour-65', 'Spiti Valley Circuit via Kinnaur', ['Key Monastery Spiti', 'Spiti Valley Kaza'], /spiti|key|kaza|kinnaur/i, ['spiti valley']),
  t('tour-67', 'Winter Spiti Snow Expedition', ['Spiti Valley winter snow', 'Kaza winter snow'], /spiti|kaza|snow|winter/i, ['spiti valley snow']),
  t('tour-66', 'Shimla, Manali & Solang Classic', ['Solang Valley', 'Manali Himachal snow mountains', 'Shimla Mall Road'], /solang|manali|shimla/i, ['manali snow mountains']),
  t('tour-85', 'Kodaikanal & Madurai: Hills and Temples', ['Kodaikanal lake', 'Kodaikanal hills'], /kodaikanal|kodai/i, ['kodaikanal lake']),
  t('tour-86', 'Ooty & Coonoor: Nilgiri Mountain Railway', ['Nilgiri Mountain Railway', 'Nilgiri Mountain Railway train Coonoor'], /nilgiri|ooty|coonoor/i, ['nilgiri mountain railway']),
  t('tour-87', 'Mahabalipuram, Pondicherry & Chennai', ['Shore Temple Mahabalipuram', 'Pondicherry French Quarter street'], /mahabalipuram|mamallapuram|shore temple|pondicherry|puducherry/i, ['mahabalipuram shore temple']),
  t('tour-90', 'Madurai, Rameswaram & Kanyakumari', ['Meenakshi Amman Temple gopuram', 'Ramanathaswamy Temple corridor', 'Vivekananda Rock Memorial'], /meenakshi|ramanathaswamy|rameswaram|vivekananda|kanyakumari|madurai/i, ['meenakshi temple madurai']),
  t('tour-91', 'Great Living Chola Temples & Navagraha', ['Brihadeeswarar Temple Thanjavur', 'Gangaikonda Cholapuram temple', 'Airavatesvara Temple Darasuram'], /brihad|thanjavur|gangaikonda|airavatesvara|darasuram|chola/i),
  t('tour-92', 'Pancha Bhoota Sthalam', ['Arunachaleswarar Temple Tiruvannamalai', 'Thillai Nataraja Temple Chidambaram', 'Ekambareswarar Temple Kanchipuram'], /arunachaleswar|tiruvannamalai|nataraja|chidambaram|ekambar|kanchipuram|jambukeswar/i),
  t('tour-704', 'Solo Female Traveller — NE Cultural Trail', ['Shillong Meghalaya hills', 'Meghalaya landscape'], /meghalaya|shillong|khasi/i, ['woman traveler mountains india']),
  t('tour-204', 'Wari Chora — Garo Hills', ['Wari Chora', 'Garo Hills river canyon'], /wari|chora|garo/i),
  t('tour-7', 'Phe Phe & Moopun Waterfalls Adventure', ['Phe Phe Falls', 'Jaintia Hills waterfall'], /phe ?phe|jaintia|moopun/i),
  t('sig-5d-meghalaya-trip-package', '5 Days Meghalaya Trip Package', ['Living root bridge Meghalaya', 'Double decker living root bridge Nongriat'], /root bridge|nongriat/i),
  // ── Page heroes with no XTSY or reviewed photo of the place ───────────
  t('hero-mizoram', 'Aizawl, Mizoram', ['Aizawl city Mizoram', 'Aizawl skyline', 'Reiek Mizoram'], /aizawl|mizoram|reiek/i, ['aizawl mizoram']),
  t('hero-tura', 'Tura, Garo Hills', ['Tura Meghalaya', 'Garo Hills Tura', 'Nokrek'], /tura|garo|nokrek/i),
  t('hero-nongstoin', 'Nongstoin, West Khasi Hills', ['West Khasi Hills', 'Nongstoin', 'Mawphanlur'], /khasi|nongstoin|mawphanlur/i),
  t('hero-mawsynram', 'Mawsynram', ['Mawsynram', 'Mawsynram Meghalaya'], /mawsynram|mawjymbuin/i),
  t('hero-shillong', 'Shillong city', ['Shillong city view', 'Shillong Ward\'s Lake', 'Shillong Police Bazar'], /shillong/i),
  t('hero-majuli', 'Majuli island', ['Majuli island Assam', 'Majuli satra'], /majuli/i),
  t('hero-ziro', 'Ziro valley', ['Ziro valley Arunachal', 'Apatani Ziro'], /ziro|apatani/i),
  // ── Destination guides with no photograph (strict place match) ─────────
  ...([
    ['mawphlang-sacred-forest', 'Mawphlang Sacred Forest', /mawphlang/i],
    ['wei-sawdong-falls', 'Wei Sawdong Falls', /sawdong/i],
    ['garden-of-caves', 'Garden of Caves', /garden of caves|ka bri ki synrang/i],
    ['arwah-cave', 'Arwah Cave', /arwah/i],
    ['dainthlen-falls', 'Dainthlen Falls', /dainthlen/i],
    ['eco-park-sohra', 'Eco Park Sohra', /eco ?park/i],
    ['nartiang-monoliths', 'Nartiang Monoliths', /nartiang/i],
    ['thadlaskein-lake', 'Thadlaskein Lake', /thadlaskein/i],
    ['balpakram-national-park', 'Balpakram National Park', /balpakram/i],
    ['nokrek-biosphere-reserve', 'Nokrek National Park', /nokrek/i],
    ['sweet-falls', 'Sweet Falls Shillong', /sweet falls/i],
    ['bishop-falls', 'Bishop Falls Shillong', /bishop|beadon/i],
    ['spread-eagle-falls', 'Spread Eagle Falls', /spread eagle/i],
    ['mawjymbuin-cave', 'Mawjymbuin Cave', /mawjymbuin/i],
    ['nongkhnum-island', 'Nongkhnum Island', /nongkhnum/i],
    ['krem-mawmluh', 'Krem Mawmluh', /mawmluh/i],
    ['siju-cave', 'Siju Cave', /siju/i],
    ['tura-peak', 'Tura Peak', /tura/i],
    ['nongjrong-sunrise-viewpoint', 'Nongjrong', /nongjrong/i],
    ['kynrem-falls', 'Kynrem Falls', /kynrem/i],
    ['langshiang-falls', 'Langshiang Falls', /langshiang/i],
    ['mawryngkhang-bamboo-trail', 'Mawryngkhang bamboo trail', /mawryngkhang/i],
    ['jakrem-hot-springs', 'Jakrem hot spring', /jakrem/i],
    ['mawthadraishan-peak', 'Mawthadraishan', /mawthadraishan/i],
    ['phe-phe-falls', 'Phe Phe Falls', /phe ?phe/i],
    ['krem-liat-prah', 'Krem Liat Prah', /liat prah/i],
    ['wah-rilang-viewpoint', 'Wah Rilang', /rilang/i],
    ['ranikor', 'Ranikor', /ranikor/i],
  ] as [string, string, RegExp][]).map(([slug, label, re]) => t(`dest-${slug}`, label, [label, `${label} Meghalaya`], re)),
];
