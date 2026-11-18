import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bus, Car, Users, ShieldCheck, ExternalLink } from 'lucide-react';
import RankedPageQuestions from '@/components/seo/RankedPageQuestions';
import { TRANSPORT_REFERENCE, TRANSPORT_SOURCES } from '@/data/meghalayaTransportReference';
import { IMG } from '@/data/v2Images';
import { responsiveImage } from '@/data/cdnImages';
import { BRAND, PROPERTY_ADDRESS } from '@/data/brandFacts';

const choices = [
  { title: 'Shared taxi', icon: Users, fit: 'Flexible solo arrivals', check: 'Agree the pickup, waiting time, seat fare, luggage allowance and final stop. Do not assume a shared vehicle departs immediately or includes a hotel transfer.' },
  { title: 'Private cab', icon: Car, fit: 'Door-to-door planning', check: 'Ask for a written total covering the precise destination, vehicle, passenger capacity, luggage, tolls, parking, stops and any waiting charge.' },
  { title: 'Bus', icon: Bus, fit: 'Timetable-based travel', check: 'Confirm the operating day, boarding terminal, ticket availability and Shillong drop-off. Include both terminal transfers when comparing the journey.' },
];
const sectionClass = 'border-b border-border py-9 sm:py-12';
const paragraphClass = 'text-base leading-8 text-foreground/90';
const textLinkClass = 'text-primary underline underline-offset-4';

function SourceLink({ id }: { id: typeof TRANSPORT_SOURCES[number]['id'] }) {
  const source = TRANSPORT_SOURCES.find(item => item.id === id);
  if (!source) return null;
  return <a href={source.url} className="mt-3 inline-flex min-h-12 items-center gap-2 text-sm text-primary underline underline-offset-4">{source.title}<ExternalLink className="h-4 w-4 shrink-0" aria-hidden /></a>;
}

export default function GuwahatiToShillongTransport() {
  const image = responsiveImage(IMG.umiam);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground"><Link to="/" className={textLinkClass}>Home</Link> / Travel guide</nav>
        <header>
          <p className="mb-3 text-sm font-semibold uppercase text-primary">Arrival & road-trip reference</p>
          <h1 className="max-w-4xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Guwahati to Shillong & Meghalaya road planning</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">Choose an arrival transfer, build a realistic onward route and know what to check before you travel. Practical planning, with official sources—not a live road report.</p>
          <p className="mt-4 text-sm text-muted-foreground">Prepared by {BRAND.brand} · Sources reviewed <time dateTime={TRANSPORT_REFERENCE.reviewedIso}>{TRANSPORT_REFERENCE.reviewed}</time></p>
          <figure className="my-7">
            <img src={image?.src ?? IMG.umiam} srcSet={image?.srcSet} sizes="(max-width: 1024px) 100vw, 960px" alt="Umiam Lake in Meghalaya" width={image?.w ?? 1280} height={image?.h ?? 853} decoding="async" fetchPriority="high" className="aspect-[16/9] w-full rounded-lg object-cover sm:aspect-[21/9]" />
            <figcaption className="mt-2 text-sm text-muted-foreground">Umiam Lake · An optional stop when your arrival time and onward plans allow.</figcaption>
          </figure>
        </header>

        <section className="border-y border-border py-7" aria-labelledby="quick-answer">
          <h2 id="quick-answer" className="mb-3 text-2xl font-bold">In short</h2>
          <p className={paragraphClass}>Meghalaya Tourism identifies Guwahati Airport and Guwahati Railway Station as gateways for Shillong, with onward travel by taxi, shared cab or bus. Its airport-to-Shillong estimate is about three hours, but the pickup and final address matter: a city-centre stop is not the same as reaching New Shillong Township. Confirm the full journey, not just the intercity leg.</p>
          <SourceLink id="arrival" />
        </section>
        <nav aria-label="On this page" className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border py-4">
          {[['arrival', 'Arrival options'], ['routes', 'Onward routes'], ['weather', 'Rain & safety'], ['checklist', 'Transfer checklist'], ['sources', 'Sources & scope']].map(([id, label]) => <a key={id} href={`#${id}`} className="inline-flex min-h-12 items-center text-sm font-semibold text-primary underline underline-offset-4">{label}</a>)}
        </nav>

        <section id="arrival" className={`${sectionClass} scroll-mt-24`}>
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">1. Start with your actual arrival point</h2>
          <p className={paragraphClass}>If you land at Guwahati Airport, compare an airport pickup with travelling to a city boarding point first. The extra transfer can change the convenience of a lower-priced shared seat. If you arrive by train, confirm where the operator meets you rather than treating “Guwahati pickup” as a precise address. For a bus journey, confirm the terminal printed on your ticket before arranging a connecting vehicle.</p>
          <p className={`mt-4 ${paragraphClass}`}>Shillong Airport at Umroi is another gateway, but Meghalaya Tourism describes its flights as limited. Check your airline's current schedule and plan the airport-to-accommodation leg separately. Do not assume an intercity road transfer, airport transfer and sightseeing vehicle are interchangeable bookings. For a broader arrival overview, see <Link to="/travel-guide/how-to-reach-meghalaya" className={textLinkClass}>how to reach Meghalaya</Link>.</p>
          <SourceLink id="arrival" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {choices.map(({ title, icon: Icon, fit, check }) => <article key={title} className="rounded-lg border border-border p-5"><Icon className="mb-3 h-6 w-6 text-primary" aria-hidden /><h3 className="text-xl font-semibold">{title}</h3><p className="mt-2 text-sm font-medium text-primary">{fit}</p><p className="mt-3 text-sm leading-7 text-muted-foreground">{check}</p></article>)}
          </div>
          <p className={`mt-5 ${paragraphClass}`}>This reference does not publish a current fare table or fixed departure schedule: those were not established by the official sources checked. Request a dated quote from the operator. Compare the total, including terminal transfers and the final accommodation drop-off, before choosing.</p>
        </section>

        <section className={sectionClass}>
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">2. Separate road distance from journey time</h2>
          <p className={paragraphClass}>“Guwahati to Shillong” can mean different start and end points. Airport arrivals, railway-station pickups, Police Bazaar drop-offs and New Shillong accommodation will not produce identical distances. Use the exact addresses when asking for a route estimate. Do not turn a general tourism estimate into a promise that you can catch a tight onward flight.</p>
          <p className={`mt-4 ${paragraphClass}`}>The official tourism material uses an older highway label, while other route descriptions use NH6. Rather than relying on a road number alone, ask the driver to confirm the Guwahati–Shillong corridor and current navigation for your destination. Add time for traffic, luggage collection, breaks and weather. Plan your return transfer before allocating your last day to distant sightseeing.</p>
        </section>

        <section className={sectionClass}>
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">3. New Shillong or central Shillong?</h2>
          <p className={paragraphClass}>Central Shillong around Police Bazaar suits travellers who prioritise markets, city activity and access to transport stands. It also brings busy roads and street noise. New Shillong Township offers a pine-forest setting and quieter ambience; choose it if that setting fits your stay, while planning transport for city visits. Neither area is automatically the best choice for every guest.</p>
          <p className={`mt-4 ${paragraphClass}`}>XTSY's guest property is at {PROPERTY_ADDRESS}. It is not in Police Bazaar. Choose accommodation around the room type, location and transport access you need first. Our <Link to="/stays/best-hostel-in-shillong" className={textLinkClass}>New Shillong versus central Shillong stay guide</Link> helps you compare. The <Link to="/meghalaya-travel-guide" className={textLinkClass}>Meghalaya travel guide</Link> gives the wider trip context.</p>
          <SourceLink id="shillong" />
        </section>

        <section id="routes" className={`${sectionClass} scroll-mt-24`}>
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">4. Build an onward route, not a list of stops</h2>
          <p className={paragraphClass}>Start with the nights available between arrival and departure. Group nearby interests, then check the route with your driver or guide. A Shillong base can work for some outings, but repeated return drives may not suit a trip with long walks or distant stops. Consider an overnight closer to the next day's activities instead of treating every destination as a short excursion.</p>
          <ul className="mt-5 space-y-5 pl-5 list-disc">
            <li className={paragraphClass}><strong>Arrival-day scenery:</strong> consider <Link to="/destinations/meghalaya/shillong/umiam-lake" className={textLinkClass}>Umiam Lake</Link> only if daylight, luggage and your transfer arrangement allow a stop. Agree waiting and parking terms first.</li>
            <li className={paragraphClass}><strong>Sohra / Cherrapunji:</strong> use the <Link to="/cherrapunji-travel-guide" className={textLinkClass}>Cherrapunji guide</Link> to choose waterfall, cave or walking interests. A demanding walk deserves its own time, not a rushed addition before a long drive.</li>
            <li className={paragraphClass}><strong>Dawki / Shnongpdeng:</strong> use the <Link to="/dawki-umngot-river-guide" className={textLinkClass}>Dawki and Umngot guide</Link> as a starting point, then confirm local activity access and conditions. Photos do not guarantee clear water or activity availability.</li>
          </ul>
          <p className={`mt-5 ${paragraphClass}`}>For a longer framework, the <Link to="/10-day-meghalaya-itinerary" className={textLinkClass}>ten-day Meghalaya itinerary</Link> is a proposal to adapt—not a reservation or proof that each activity is open on your dates. Confirm walking ability, luggage arrangements and overnight locations before committing.</p>
        </section>

        <section id="weather" className={`${sectionClass} scroll-mt-24`}>
          <h2 className="mb-4 flex items-start gap-3 text-2xl font-bold sm:text-3xl"><ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-primary" aria-hidden />5. Rain, visibility and route checks</h2>
          <p className={paragraphClass}>Meghalaya Tourism describes June to September as the heavy-rain monsoon season. That seasonal pattern is not a forecast for your travel day. Rain and mist can affect visibility and outdoor plans beyond those months too. Keep flexibility in your itinerary and distinguish a weather warning from a confirmed road closure: one does not automatically establish the other.</p>
          <SourceLink id="season" />
          <p className={`mt-4 ${paragraphClass}`}>Before departure, check IMD's current warnings for the relevant districts and their issue time, then check local official notices and ask the operator about the exact road being used. We do not provide live road clearance, landslide alerts or a live forecast here. Do not proceed through a closure or use an unfamiliar diversion merely because an old travel article suggests it.</p>
          <SourceLink id="weather" />
          <p className={`mt-4 ${paragraphClass}`}>As practical precautions, favour daylight where possible, carry a charged phone and an offline copy of your accommodation address, and leave room for delays. Avoid pressuring a driver to make up lost time. If conditions disrupt the route, recheck the plan with the operator rather than making a safety decision from this static guide.</p>
        </section>

        <section id="checklist" className={`${sectionClass} scroll-mt-24`}>
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">6. A checklist for your transfer quote</h2>
          <p className={paragraphClass}>Send the same details to each operator so you compare like with like. A useful request includes:</p>
          <ol className="mt-4 list-decimal space-y-3 pl-6 text-base leading-7">
            <li>Arrival date, flight or train details, and the exact meeting point.</li>
            <li>Passenger count, luggage quantity and any access or child-seat requirements.</li>
            <li>The complete destination address and whether it is a direct drop-off.</li>
            <li>Vehicle category and a total with tolls, parking, waiting and stops itemised.</li>
            <li>Payment terms, cancellation terms and what happens if arrival is delayed.</li>
            <li>Driver contact arrangements and reconfirmation before departure.</li>
          </ol>
          <p className={`mt-5 ${paragraphClass}`}>For self-drive travel, check the rental agreement, permitted area, documents, insurance conditions and breakdown support. Our <Link to="/tours/xtsy-rentals" className={textLinkClass}>Assam and Meghalaya rental catalogue</Link> is a starting point for an enquiry, not a substitute for confirming those terms with the desk.</p>
        </section>

        <RankedPageQuestions path={TRANSPORT_REFERENCE.path} />

        <section id="sources" className={`${sectionClass} scroll-mt-24`}>
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">Sources, scope & corrections</h2>
          <p className={paragraphClass}>Sources below were read on {TRANSPORT_REFERENCE.reviewed}. Official tourism pages support gateway and seasonal facts; route grouping and the transfer checklist are XTSY planning suggestions. No live operator timetable, road-status feed or current fare sheet was verified. A review date records when the sources were checked, not a guarantee that conditions remain unchanged.</p>
          <ul className="mt-5 divide-y divide-border">
            {TRANSPORT_SOURCES.map(source => <li key={source.id} className="py-4"><a href={source.url} className="inline-flex min-h-12 items-center gap-2 font-semibold text-primary underline underline-offset-4">{source.title}<ExternalLink aria-hidden className="h-4 w-4 shrink-0" /></a><p className="text-sm leading-7 text-muted-foreground">{source.scope}</p></li>)}
          </ul>
          <p className={`mt-4 ${paragraphClass}`}>To cite this reference, use this page's permanent address and include the source-review date. For a correction, share the relevant passage and a dated official source with the XTSY desk at {BRAND.whatsappDisplay}. {BRAND.legalName} is based in {BRAND.hqCity}; the guest property is in New Shillong Township. This is an independently prepared guide, not an official transport bulletin.</p>
        </section>
        <section className="pt-9">
          <h2 className="text-2xl font-bold">Choose the stay after the route</h2>
          <p className="my-4 max-w-3xl text-base leading-8 text-muted-foreground">If New Shillong and the available room types fit your needs, share your dates with the desk. An enquiry does not confirm availability or a transfer; confirm those details before travelling.</p>
          <Button asChild className="min-h-12 h-auto whitespace-normal px-6 py-3"><Link to="/book">Enquire about a New Shillong stay<ArrowRight aria-hidden /></Link></Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
