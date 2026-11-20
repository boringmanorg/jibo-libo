/**
 * /book extras around the booking engine: where-to-stay picker, the full property gallery, the
 * XTSY brand story and cross-promotions (tours and rentals; different on each step).
 * Copy uses only owner-stated facts and the site's existing tour and rental prices.
 */
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Images, MapPin, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { IMG } from '@/data/v2Images';
import { ROOM_IMAGES } from '@/config/roomTypes';
import { SATURDAY_GROUP_TOUR } from '@/data/saturdayGroupTour';
import { openTripChat } from '@/components/v2/tripChatEvents';
import { cn } from '@/lib/utils';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export type BookLocation = 'new-shillong' | 'dawki';

/** Every XTSY Travellers Hostel photo: property first, then each room's gallery, without repeats. */
export const NEW_SHILLONG_PHOTOS: { src: string; alt: string }[] = (() => {
  const seen = new Set<string>();
  const out: { src: string; alt: string }[] = [];
  const add = (list: string[] | undefined, alt: string) => {
    for (const src of list ?? []) if (src && !seen.has(src)) { seen.add(src); out.push({ src, alt }); }
  };
  add(IMG.property, 'XTSY Travellers Hostel in the pines, New Shillong Township');
  add(ROOM_IMAGES['xtsy-270'], 'Experience by XTSY glass suite');
  add(ROOM_IMAGES['king-double-room'], 'King Room with Mountain View');
  add(ROOM_IMAGES['4-bed-female-only-dorm'], 'Female deluxe dormitory');
  add(ROOM_IMAGES['6-bed-mixed-dorm'], 'Six-bed mixed dormitory');
  add(ROOM_IMAGES['8-bed-mixed-dorm'], 'Eight-bed mixed dormitory');
  add(IMG.bistro, 'TAB Bistro by XTSY on the property');
  return out;
})();

export const DAWKI_PHOTOS = IMG.campsite.map((src) => ({ src, alt: 'XTSY Adventure Campsite by the Umngot river, Dawki' }));

const LOCATIONS: { id: BookLocation; place: string; name: string; line: string; photo: string; stays: string }[] = [
  {
    id: 'new-shillong', place: 'New Shillong', name: 'XTSY Travellers Hostel', photo: IMG.property[0] ?? NEW_SHILLONG_PHOTOS[0]?.src,
    line: 'Mawdiangdiang Road, New Shillong Township. Dorm beds, private rooms and Experience by XTSY, with TAB Bistro on the property.',
    stays: 'Dorms from ₹400, rooms from ₹2,400, plus GST',
  },
  {
    id: 'dawki', place: 'Dawki', name: 'XTSY Adventure Campsite', photo: IMG.campsite[0],
    line: 'Riverside tents by the Umngot river, with bonfire and kayaking add-ons.',
    stays: `Camping from ${inr(800)} per person a night`,
  },
];

export function LocationPicker({ onPick }: { onPick: (l: BookLocation) => void }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8" aria-labelledby="where">
      <h1 id="where" className="xt-display text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.9] text-xt-ink">Where would you like to stay?</h1>
      <p className="mt-3 max-w-2xl text-base text-xt-mute">Two XTSY stays in Meghalaya. Pick one to see rooms and prices.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {LOCATIONS.map((l) => (
          <button key={l.id} type="button" onClick={() => onPick(l.id)}
            className="group overflow-hidden rounded-[28px] border border-xt-line bg-[#FBF8F3] text-left transition-shadow hover:shadow-[0_18px_40px_-20px_rgba(31,34,48,.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xt-ink">
            <div className="relative aspect-[16/10] overflow-hidden">
              <img src={l.photo} alt={`${l.name}, ${l.place}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-xt-ink"><MapPin className="h-4 w-4 text-xt-crimson" aria-hidden />{l.place}</span>
            </div>
            <div className="space-y-2 p-6">
              <p className="xt-display text-4xl leading-none text-xt-ink">{l.name}</p>
              <p className="text-[15px] text-xt-mute">{l.line}</p>
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-sm font-bold text-xt-pine">{l.stays}</span>
                <span className="flex min-h-11 items-center gap-2 rounded-full bg-xt-crimson px-5 text-sm font-bold text-white">See stays <ArrowRight className="h-4 w-4" aria-hidden /></span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Photo strip with a "See all photos" gallery. */
export function PhotoStrip({ photos }: { photos: { src: string; alt: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Photos">
        {photos.slice(0, 12).map((p, i) => (
          <img key={p.src} src={p.src} alt={p.alt} loading={i < 3 ? 'eager' : 'lazy'}
            className={cn('h-60 shrink-0 snap-start rounded-[28px] object-cover sm:h-80', i === 0 ? 'w-[82%] sm:w-[46%]' : i % 2 ? 'w-[64%] sm:w-[26%]' : 'w-[72%] sm:w-[34%]')} />
        ))}
      </div>
      {photos.length > 1 && (
        <button type="button" onClick={() => setOpen(true)}
          className="absolute bottom-6 right-2 flex min-h-11 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-bold text-xt-ink shadow-md sm:right-0">
          <Images className="h-4 w-4" aria-hidden /> See all {photos.length} photos
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-[28px] border-xt-line bg-xt-sand p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="xt-display text-3xl font-normal text-xt-ink">All photos</DialogTitle>
            <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-xt-oat" aria-label="Close photos"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 columns-1 gap-3 sm:columns-2 lg:columns-3">
            {photos.map((p) => <img key={p.src} src={p.src} alt={p.alt} loading="lazy" className="mb-3 w-full break-inside-avoid rounded-2xl" />)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FAMILY = [
  { name: 'XTSY Travellers Hostel', line: 'Dorms and private rooms in the pines of New Shillong Township, with a bonfire every night for in-house guests.', to: '/stays/hostel-booking', img: IMG.property[1] ?? IMG.property[0] },
  { name: 'Experience by XTSY', line: 'A glass suite for two on the same property. Sky visibility depends on the weather.', to: '/stays/experience-by-xtsy', img: IMG.suite[0] },
  { name: 'TAB Bistro by XTSY', line: 'Breakfast from 8:45 AM and dinner from 5 PM, on the property and on Zomato and Swiggy.', to: '/tab-bistro', img: IMG.bistro[0] },
  { name: 'XTSY Voyage', line: 'Tours across Meghalaya and the Northeast, plus self-drive cars and Royal Enfield rentals.', to: '/tours/meghalaya-tour-packages', img: IMG.nohkalikai },
];

export function BrandStory() {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-4" aria-labelledby="brand-story">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-end">
        <h2 id="brand-story" className="xt-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.9] text-xt-ink">Made in Meghalaya, many ways in</h2>
        <p className="text-[15px] leading-relaxed text-xt-mute">
          XTSY is built in Meghalaya by XTSY Ventures Private Limited, a travel-tech company. The hostel in New Shillong is where we host travellers,
          learn how people explore the Northeast, and build the booking software you are using now. We work alongside local homestays and
          restaurants rather than against them; TAB Bistro’s menu leaves local dishes to local kitchens.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FAMILY.map((f) => (
          <Link key={f.name} to={f.to} className="group overflow-hidden rounded-[24px] border border-xt-line bg-[#FBF8F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xt-ink">
            {f.img && <img src={f.img} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />}
            <div className="space-y-1.5 p-4">
              <p className="xt-display text-2xl leading-none text-xt-ink">{f.name}</p>
              <p className="text-sm text-xt-mute">{f.line}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

type Promo = { kicker: string; title: string; line: string; price: string; cta: string; img: string; to?: string; onClick?: () => void };

const STEP_ONE_PROMOS: Promo[] = [
  {
    kicker: 'Group tour', title: SATURDAY_GROUP_TOUR.name.replace(/\s*\(.*\)$/, ''), img: IMG.nohkalikai,
    line: `${SATURDAY_GROUP_TOUR.duration}: ${SATURDAY_GROUP_TOUR.route}. Transport with driver and nights at this hostel with breakfast.`,
    price: `${inr(SATURDAY_GROUP_TOUR.pricePerPerson)} per person, from ${SATURDAY_GROUP_TOUR.minGroup} guests`, cta: 'See the tour', to: '/tours/meghalaya-tour-packages',
  },
  {
    kicker: 'Self-drive', title: 'Drive Meghalaya yourself', img: IMG.laitlum,
    line: 'Self-drive cars for Assam and Meghalaya, fully insured with 24/7 roadside support. Driver on request.',
    price: `From ${inr(2000)} a day, 400 km included`, cta: 'See cars', to: '/tours/xtsy-rentals',
  },
];

const STEP_TWO_PROMOS: Promo[] = [
  {
    kicker: 'Bike rental', title: 'Ride a Royal Enfield', img: IMG.bumla,
    line: 'Pick up a Royal Enfield for Meghalaya’s hill roads, with roadside support across Assam and Meghalaya.',
    price: `From ${inr(1300)} a day`, cta: 'See bikes', to: '/tours/xtsy-rentals',
  },
  {
    kicker: 'Custom trip', title: 'Plan the days around your stay', img: IMG.rootBridge,
    line: 'Tell our AI planner your dates and interests; XTSY Voyage turns it into a tour with transport.',
    price: 'Free to plan', cta: 'Plan with AI', onClick: () => openTripChat('Plan my days in Meghalaya around my XTSY stay'),
  },
];

export function Promotions({ step }: { step: 1 | 2 }) {
  const promos = step === 1 ? STEP_ONE_PROMOS : STEP_TWO_PROMOS;
  return (
    <section className="mx-auto mt-16 max-w-6xl px-4" aria-labelledby={`promos-${step}`}>
      <h2 id={`promos-${step}`} className="xt-display text-4xl text-xt-ink">{step === 1 ? 'Make a trip of it' : 'Before you go'}</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {promos.map((p) => {
          const body = (
            <>
              <div className="relative h-full min-h-48 sm:w-2/5 sm:shrink-0">
                <img src={p.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute left-3 top-3 rounded-full bg-xt-ink px-3 py-1 text-xs font-bold text-xt-sand">{p.kicker}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5">
                <p className="xt-display text-3xl leading-none text-xt-sand">{p.title}</p>
                <p className="text-sm text-xt-fog">{p.line}</p>
                <p className="mt-auto pt-2 text-sm font-bold text-white">{p.price}</p>
                <span className="mt-2 flex min-h-11 w-fit items-center gap-2 rounded-full bg-xt-crimson px-5 text-sm font-bold text-white">{p.cta} <ArrowRight className="h-4 w-4" aria-hidden /></span>
              </div>
            </>
          );
          const cls = 'flex flex-col overflow-hidden rounded-[28px] bg-xt-night text-left sm:flex-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xt-crimson';
          return p.to ? (
            <Link key={p.title} to={p.to} className={cls}>{body}</Link>
          ) : (
            <button key={p.title} type="button" onClick={p.onClick} className={cls}>{body}</button>
          );
        })}
      </div>
    </section>
  );
}

export function DawkiPanel({ onBack }: { onBack: () => void }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8">
      <button type="button" onClick={onBack} className="mb-4 flex min-h-11 items-center gap-2 text-sm font-semibold text-xt-mute hover:text-xt-ink">← Change location</button>
      <h1 className="xt-display text-[clamp(3rem,9vw,6rem)] leading-[0.88] text-xt-ink">XTSY Adventure Campsite</h1>
      <p className="mt-3 text-base text-xt-mute">By the Umngot river, Dawki, Meghalaya</p>
      <PhotoStrip photos={DAWKI_PHOTOS} />
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {[{ t: 'Only camping', p: 800, l: 'A riverside tent, bonfire evenings.' }, { t: 'Camping + breakfast', p: 1000, l: 'A riverside tent with breakfast the next morning.' }].map((x) => (
          <div key={x.t} className="rounded-[28px] border border-xt-line bg-[#FBF8F3] p-6">
            <p className="xt-display text-3xl text-xt-ink">{x.t}</p>
            <p className="mt-1 text-[15px] text-xt-mute">{x.l}</p>
            <p className="mt-4"><span className="text-2xl font-extrabold text-xt-ink">{inr(x.p)}</span><span className="text-sm text-xt-mute"> per person a night</span></p>
          </div>
        ))}
      </div>
      <Link to="/book/campsite" className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-xt-crimson font-bold text-white sm:w-fit sm:px-8">Check dates for the campsite <ArrowRight className="h-4 w-4" aria-hidden /></Link>
    </section>
  );
}
