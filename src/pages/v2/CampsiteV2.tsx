/**
 * /stays/campsite-dawki — Shnonpedeng riverside camping (the URL is kept for existing links).
 * The camp is an XTSY franchise accommodation partner; the partner runs the camp and its meals,
 * and the XTSY desk takes the booking. Prices come from src/data/shnonpedengCamp.ts.
 */
import { Helmet } from '@/lib/seo/helmet';
import SEOHead from '@/components/SEOHead';
import { PageShell, PageHero, Btn, Section, H2, PriceCards, FaqList, PAD } from '@/components/v2/blocks';
import { Photo, waLink } from '@/components/v2/primitives';
import { CAMP, CAMP_GST_NOTE, CAMP_MEALS, CAMP_PHOTOS, CAMP_PLANS } from '@/data/shnonpedengCamp';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const FAQS = [
  { q: 'Where is the camp?', a: `${CAMP.where}. Tell the XTSY desk your dates and it shares directions, or arranges a ride from New Shillong.` },
  { q: 'Who runs the camp?', a: `${CAMP.name} is an XTSY franchise accommodation partner. The partner runs the camp and its meals; it is not run by TAB Bistro or XTSY Travellers Hostel. You book through the XTSY desk, which stays your contact.` },
  { q: 'What does a tent cost?', a: `A full tent for two is ${inr(CAMP_PLANS.tent.price)} a night, with camping and bonfire. A solo traveller can take one bed space in a shared two-person tent for ${inr(CAMP_PLANS.bed.price)} a night.` },
  { q: 'Can I add meals?', a: `Yes, add them with your booking. Breakfast is ${inr(CAMP_MEALS.breakfast.price)} a person. Dinner is ${inr(CAMP_MEALS.dinnerVeg.price)} a person for veg or ${inr(CAMP_MEALS.dinnerNonVeg.price)} for non-veg. The partner prepares the meals.` },
  { q: 'What is the cancellation policy?', a: 'Bookings are non-refundable. You can change your dates once, if you ask at least 14 days before check-in, subject to availability.' },
];

export default function CampsiteV2() {
  const wa = waLink(`Hi XTSY! I want to book ${CAMP.name}. Dates: … Full tents: … Bed spaces: … Meals: breakfast / veg dinner / non-veg dinner`);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Campground',
    name: CAMP.name,
    description: `Riverside tents on the Umngot at Shnonpedeng, Meghalaya, at an XTSY franchise accommodation partner. Full tent for two ${inr(CAMP_PLANS.tent.price)} a night; one bed space ${inr(CAMP_PLANS.bed.price)} a night.`,
    telephone: '+918837317070',
    image: CAMP_PHOTOS.slice(0, 5).map((p) => (p.src.startsWith('http') ? p.src : `https://xtsy.one${p.src}`)),
    address: { '@type': 'PostalAddress', addressLocality: 'Shnonpedeng', addressRegion: 'Meghalaya', addressCountry: 'IN' },
    priceRange: `${inr(CAMP_PLANS.bed.price)} - ${inr(CAMP_PLANS.tent.price)}`,
  };
  return (
    <>
      <SEOHead
        title={`${CAMP.name} from ${inr(CAMP_PLANS.bed.price)}`}
        description={`Riverside tents on the Umngot at Shnonpedeng, an XTSY franchise partner camp. Full tent for two ${inr(CAMP_PLANS.tent.price)} a night, bed space ${inr(CAMP_PLANS.bed.price)}, breakfast and dinner on request.`}
        keywords="shnonpedeng camping, shnongpdeng camping, umngot river camping, riverside camping meghalaya, xtsy partner camp"
        canonicalUrl="https://xtsy.one/xtsy-adventure-campsite-dawki"
      />
      <Helmet><script type="application/ld+json">{JSON.stringify(ld)}</script></Helmet>
      <PageShell bar={{ label: 'Book a tent', to: '/book/campsite', note: CAMP.name }} cta={{ title: 'Pitch up by the Umngot.', sub: 'Pick your tent and meals online, or tell the desk your dates on WhatsApp.', bookTo: '/book/campsite', bookLabel: 'Book online' }}>
        <PageHero
          bg="#2F4A3F"
          fg="#EAF0EA"
          muted="#C8D6CC"
          eyebrowColor="#F2B8C2"
          eyebrow={`${CAMP.name} · ${CAMP.partnerLine}`}
          title="Sleep beside the Umngot."
          text={`Riverside tents at Shnonpedeng with a bonfire in the evening. ${CAMP.name} is an XTSY franchise accommodation partner: the partner runs the camp and its kitchen, and the XTSY desk takes your booking and stays your contact.`}
          actions={<><Btn to="/book/campsite">Book a tent</Btn><Btn to={wa} kind="outline-light">Ask on WhatsApp</Btn><Btn to="/check-in" kind="outline-light">Self check-in</Btn></>}
          media={<Photo src={CAMP_PHOTOS[0]?.src} alt={CAMP_PHOTOS[0]?.alt ?? 'Riverside tents on the Umngot'} eager tone="slate" className="aspect-[628/560] rounded-[32px]" />}
        />

        <Section id="packages">
          <H2 eyebrow="Per night">Pick your tent</H2>
          <p className="m-0 text-[14px] text-xt-mute">{CAMP_GST_NOTE}</p>
          <PriceCards
            cards={[
              { t: CAMP_PLANS.tent.title, price: inr(CAMP_PLANS.tent.price), text: `${CAMP_PLANS.tent.line} Price is ${CAMP_PLANS.tent.unit}.`, hot: true, cta: <Btn to="/book/campsite" className="w-full">Book a tent</Btn> },
              { t: CAMP_PLANS.bed.title, price: inr(CAMP_PLANS.bed.price), text: `${CAMP_PLANS.bed.line} Price is ${CAMP_PLANS.bed.unit}.`, cta: <Btn to="/book/campsite" kind="outline" className="w-full">Book a bed space</Btn> },
            ]}
          />
          <div className="xt-reveal flex flex-col gap-3 rounded-3xl bg-xt-cream p-7">
            <span className="text-[15px] font-extrabold">Meals, added with your booking</span>
            <div className="flex flex-wrap gap-2">
              {Object.values(CAMP_MEALS).map((m) => <span key={m.id} className="rounded-full bg-white px-4 py-2 text-[14px] font-bold">{m.title} {inr(m.price)}</span>)}
            </div>
            <p className="m-0 text-[14px] text-xt-mute">Per person. {CAMP.mealsNote}</p>
          </div>
        </Section>

        <section className={`${PAD} grid gap-6 pb-16 sm:grid-cols-3`}>
          {CAMP_PHOTOS.slice(0, 6).map((p, i) => (
            <Photo key={p.src} src={p.src} alt={p.alt} tone={(['pine', 'slate', 'sand'] as const)[i % 3]} className="xt-reveal aspect-[421/300] rounded-3xl" />
          ))}
        </section>

        <FaqList faqs={FAQS} />
      </PageShell>
    </>
  );
}
