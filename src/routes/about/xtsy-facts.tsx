import { createFileRoute } from "@tanstack/react-router";
import XtsyFacts from "@/pages/XtsyFacts";
import { buildRouteHead } from "@/lib/seo-head";

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://xtsy.one/#organization',
  name: 'XTSY',
  legalName: 'XTSY Ventures Private Limited',
  url: 'https://xtsy.one',
  logo: 'https://xtsy.one/xtsy-color-logo.png',
  founder: { '@type': 'Person', name: 'Dhayanidhi Amrudheen D' },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Mawdiangdiang Road, New Shillong Township',
    addressLocality: 'Shillong',
    addressRegion: 'Meghalaya',
    postalCode: '793018',
    addressCountry: 'IN',
  },
  geo: { '@type': 'GeoCoordinates', latitude: 25.6025457, longitude: 91.9448902 },
  contactPoint: [
    { '@type': 'ContactPoint', contactType: 'reservations', email: 'booking@xtsy.one', telephone: '+91-8837317070' },
    { '@type': 'ContactPoint', contactType: 'customer support', email: 'admin@xtsy.one' },
  ],
  sameAs: [
    'https://www.youtube.com/@XTSY_Voyage',
    'https://www.instagram.com/xtsy.one',
    'https://maps.app.goo.gl/UnP9PfbSJdafMFMM6',
  ],
  subOrganization: [
    { '@type': 'LodgingBusiness', name: 'XTSY Travellers Hostel', url: 'https://xtsy.one/best-hostel-in-shillong' },
    { '@type': 'Restaurant', name: 'TAB Bistro by XTSY', url: 'https://xtsy.one/tab-bistro' },
    { '@type': 'TravelAgency', name: 'XTSY Voyage', url: 'https://xtsy.one/tours' },
  ],
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://xtsy.one/' },
    { '@type': 'ListItem', position: 2, name: 'About', item: 'https://xtsy.one/about' },
    { '@type': 'ListItem', position: 3, name: 'XTSY Facts', item: 'https://xtsy.one/about/xtsy-facts' },
  ],
};

export const Route = createFileRoute("/about/xtsy-facts")({
  head: () =>
    buildRouteHead({
      path: "/about/xtsy-facts",
      title: "XTSY Facts: Legal Name, Founder, Address & Policies | XTSY",
      description:
        "The verifiable XTSY fact sheet: XTSY Ventures Private Limited, founder Dhayanidhi Amrudheen D, New Shillong Township address, businesses, policies and official profiles.",
      keywords: "XTSY facts, XTSY Ventures Private Limited, who owns XTSY, XTSY Shillong address, XTSY founder",
      jsonLd: [organizationSchema, breadcrumbSchema],
    }),
  component: XtsyFacts,
});
