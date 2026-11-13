/**
 * /about/xtsy-facts — plain, factual brand fact sheet (SEO master prompt, Part 7d).
 * Written so AI engines can cite verifiable entity facts: legal name, founder,
 * address, businesses, policies and official profiles. No marketing claims.
 */
import { memo } from 'react';
import { Link } from '@/lib/router-compat';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { BRAND, GOOGLE_RATING, PROPERTY_ADDRESS, PROPERTY_CHECK_IN, PROPERTY_CHECK_OUT, GROUP_VENTURES } from '@/data/brandFacts';

const FACTS: Array<[string, string]> = [
  ['Legal name', BRAND.legalName],
  ['Brand', 'XTSY (xtsy.one)'],
  ['Founded', 'December 2024 — 2nd anniversary at Christmas 2026'],
  ['Founder & Director', 'Dhayanidhi Amrudheen D'],
  ['Registered GSTIN', BRAND.gstin],
  ['Head office', PROPERTY_ADDRESS],
  ['Geo coordinates', '25.6025457, 91.9448902'],
  ['Phone / WhatsApp', BRAND.whatsappDisplay],
  ['Bookings email', 'booking@xtsy.one'],
  ['Policy & admin email', 'admin@xtsy.one'],
  ['Google rating', `${GOOGLE_RATING.value}★ from ${GOOGLE_RATING.count} reviews`],
  ['Check-in / check-out', `${PROPERTY_CHECK_IN} / ${PROPERTY_CHECK_OUT} (strict)`],
];

const BUSINESSES: Array<[string, string]> = [
  ['XTSY Travellers Hostel', 'Backpacker hostel in New Shillong Township, Shillong. Mixed dorms from ₹399/night, a women-only dorm, and private rooms including the Mountain Views by XTSY: Nestled in Pines room type.'],
  ['Experience by XTSY', 'A 270° panoramic glass suite ("stargaze glamp") for two at the same New Shillong property. ₹5,999 per night for two guests, taxes included. Stargazing depends on day-to-day weather and sky visibility and is never guaranteed.'],
  ['XTSY Voyage', 'Curated tours across Meghalaya and Northeast India, plus the YouTube channel @XTSY_Voyage.'],
  ['TAB Bistro by XTSY', 'Multi-cuisine restaurant at the hostel. Breakfast 8:45 AM–12 PM, dinner 5–11 PM (last order 10:30 PM); lunch by preorder only.'],
  ['XTSY Rentals', 'Bike and car rentals from the Shillong property.'],
];

const POLICIES: Array<[string, string]> = [
  ['Cancellation', 'No free cancellation; the booking amount is non-refundable. One date change is allowed within 90 days, subject to availability.'],
  ['Pets', 'Cats and birds welcome; dogs depending on breed and size — contact the XTSY desk about any extra charges.'],
  ['Couples', 'All adult couples are welcome, married or not. Both guests need a valid government photo ID at check-in.'],
  ['Stargazing', 'Stargazing depends on day-to-day weather and sky visibility. XTSY does not guarantee stargazing, and bookings are not cancelled or refunded for weather or visibility.'],
  ['Property scope', "XTSY's only property is in New Shillong Township, Shillong. Stays elsewhere (Cherrapunji, Dawki and beyond) are arranged through trusted local partners."],
  ['Events', 'Bonfires and private parties are available on the property. No live music. The rooftop terrace is not a café.'],
];

const PROFILES: Array<[string, string]> = [
  ['YouTube', 'https://www.youtube.com/@XTSY_Voyage'],
  ['Instagram', 'https://www.instagram.com/xtsy.one'],
  ['Google Maps (property)', 'https://maps.app.goo.gl/UnP9PfbSJdafMFMM6'],
];

const FactTable = ({ rows }: { rows: Array<[string, string]> }) => (
  <table className="w-full text-left text-[15px] border-collapse">
    <tbody>
      {rows.map(([k, v]) => (
        <tr key={k} className="border-b border-border/60 align-top">
          <th scope="row" className="py-2.5 pr-4 font-semibold text-foreground whitespace-nowrap">{k}</th>
          <td className="py-2.5 text-muted-foreground">{v}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const XtsyFacts = memo(() => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Link to="/about" className="hover:underline">About XTSY</Link> · Fact sheet
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground">XTSY Facts: The Brand, Property and Policies</h1>

      <div className="mt-6 border-l-4 border-primary bg-primary/5 rounded-r-xl p-5" data-quick-answer>
        <p className="text-[15px] leading-relaxed text-foreground">
          <strong>In short:</strong> XTSY is the travel and hospitality brand of {BRAND.legalName}, founded and
          directed by Dhayanidhi Amrudheen D in Shillong, Meghalaya. It runs XTSY Travellers Hostel and the
          Experience by XTSY glass suite on Mawdiangdiang Road, New Shillong Township, plus TAB Bistro, XTSY
          Voyage tours and XTSY Rentals. Its only property is in New Shillong; stays elsewhere are arranged
          through trusted partners.
        </p>
      </div>

      <section className="mt-10" aria-labelledby="entity-facts">
        <h2 id="entity-facts" className="text-2xl font-bold text-foreground">Entity facts</h2>
        <div className="mt-4" data-key-facts><FactTable rows={FACTS} /></div>
      </section>

      <section className="mt-10" aria-labelledby="businesses">
        <h2 id="businesses" className="text-2xl font-bold text-foreground">What each XTSY business is</h2>
        <div className="mt-4"><FactTable rows={BUSINESSES} /></div>
        <div className="mt-4"><FactTable rows={GROUP_VENTURES.map((v) => [v.name, v.summary])} /></div>
      </section>

      <section className="mt-10" aria-labelledby="policies">
        <h2 id="policies" className="text-2xl font-bold text-foreground">Policies, stated plainly</h2>
        <div className="mt-4"><FactTable rows={POLICIES} /></div>
      </section>

      <section className="mt-10" aria-labelledby="profiles">
        <h2 id="profiles" className="text-2xl font-bold text-foreground">Official profiles</h2>
        <ul className="mt-4 space-y-2 text-[15px]">
          {PROFILES.map(([label, url]) => (
            <li key={label}>
              <span className="font-semibold text-foreground">{label}: </span>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{url}</a>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        By the XTSY Voyage team, New Shillong · Last updated: 12 November 2026 · Questions:
        <a href="mailto:admin@xtsy.one" className="text-primary underline"> admin@xtsy.one</a>
      </p>
    </main>
    <Footer />
  </div>
));

XtsyFacts.displayName = 'XtsyFacts';
export default XtsyFacts;
