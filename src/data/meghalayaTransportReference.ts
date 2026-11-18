import { BRAND } from './brandFacts';

export const TRANSPORT_REFERENCE = {
  path: '/travel-guide/guwahati-to-shillong-transport',
  title: 'Guwahati to Shillong & Meghalaya Road Planning Guide | XTSY',
  description: 'Plan Guwahati–Shillong arrivals, compare taxis and buses, choose your stay area and organise Meghalaya road trips with official sources and safety checks.',
  reviewed: '18 November 2026',
  reviewedIso: '2026-11-18',
};

export const TRANSPORT_SOURCES = [
  { id: 'arrival', title: 'Meghalaya Tourism: travel by air, rail and road', url: 'https://www.meghalayatourism.in/plan/how-to-reach/air-rail-road/', scope: 'Gateway airports, Guwahati rail access and taxi/bus options. Not a live timetable or fare sheet.' },
  { id: 'season', title: 'Meghalaya Tourism: travel essentials', url: 'https://www.meghalayatourism.in/plan/travel-essentials/', scope: 'Seasonal context, including heavy monsoon rainfall. Not a forecast or road-clearance notice.' },
  { id: 'shillong', title: 'Meghalaya Tourism: Shillong destination guide', url: 'https://www.meghalayatourism.in/explore/destinations/main-towns/shillong/', scope: 'Shillong neighbourhood character and seasonal travel context.' },
  { id: 'weather', title: 'India Meteorological Department', url: 'https://mausam.imd.gov.in/', scope: 'Official weather warnings and forecasts. Check the relevant district and issue time yourself.' },
] as const;

export const TRANSPORT_QUESTIONS = [
  { q: 'Which transport options connect Guwahati and Shillong?', a: 'Meghalaya Tourism lists taxis, shared cabs and buses from Guwahati. Choose around your arrival time, luggage and final destination; confirm pickup, departure and drop-off directly with the operator.' },
  { q: 'How much time should I allow from Guwahati to Shillong?', a: 'Meghalaya Tourism gives an approximate three-hour road journey from Guwahati Airport. Your actual trip depends on the pickup, final address, traffic, stops and weather. This is not a guaranteed transfer time; allow a separate buffer for a flight or train.' },
  { q: 'Will a shared taxi take me directly to XTSY?', a: 'Do not assume a shared taxi includes your accommodation drop-off. Confirm the exact Shillong stop with the operator and arrange onward travel to Mawdiangdiang Road, New Shillong Township, if staying at XTSY.' },
  { q: 'Does this guide show live road conditions or a live weather forecast?', a: 'No. This is a planning reference, not a live forecast or road-status feed. Check current IMD warnings and local official notices before departure; ask your operator about the specific route.' },
  { q: 'Can I take a train directly to Shillong?', a: 'Meghalaya Tourism identifies Guwahati Railway Station as the rail gateway for this journey. Plan an onward road transfer to Shillong rather than assuming the train reaches Shillong.' },
];

export function transportReferenceSchema() {
  return [
    {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: TRANSPORT_REFERENCE.title, description: TRANSPORT_REFERENCE.description,
      datePublished: '2026-07-21', dateModified: TRANSPORT_REFERENCE.reviewedIso,
      author: { '@type': 'Organization', name: BRAND.brand, url: 'https://xtsy.one/about/xtsy-facts' },
      publisher: { '@type': 'Organization', name: BRAND.legalName, url: 'https://xtsy.one' },
      mainEntityOfPage: `https://xtsy.one${TRANSPORT_REFERENCE.path}`,
      citation: TRANSPORT_SOURCES.map(source => source.url),
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: TRANSPORT_QUESTIONS.map(faq => ({ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://xtsy.one/' },
        { '@type': 'ListItem', position: 2, name: 'Guwahati–Shillong road planning', item: `https://xtsy.one${TRANSPORT_REFERENCE.path}` },
      ],
    },
  ];
}