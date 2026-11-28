/**
 * SiteFooter (v2) — crimson word marquee + ink footer with the real address,
 * the partner-facilitation note and every key link.
 */
import { PlatformLogoStrip } from '@/components/v2/PlatformLogoStrip';
import { LISTING_LOGOS, SOCIAL_LOGOS } from '@/data/platformLogos';
import { Link } from '@/lib/router-compat';
import { Marquee, XtsyMark, WHATSAPP_DISPLAY } from './primitives';

const COLS = [
  {
    title: 'Stay',
    links: [
      { to: '/book', label: 'Book a room' },
      { to: '/stays/experience-by-xtsy', label: 'Experience by XTSY' },
      { to: '/stays/campsite-dawki', label: 'Shnonpedeng Riverside Camping by XTSY' },
      { to: '/stays/pet-friendly', label: 'Pet-friendly stays' },
      { to: '/stays/female-travellers', label: 'Women safe stays' },
      { to: '/stays/workation', label: 'Workation' },
      { to: '/stays/best-hostel-in-shillong', label: 'Hostels in Shillong' },
    ],
  },
  {
    title: 'Travel',
    links: [
      { to: '/tours', label: 'Tour packages' },
      { to: '/expeditions', label: 'Expeditions' },
      { to: '/stays/group-bookings-meghalaya', label: 'Group bookings' },
      { to: '/tours/xtsy-rentals', label: 'Bike & car rentals' },
      { to: '/tours/plan-trip-with-ai', label: 'Plan a trip with AI' },
    ],
  },
  {
    title: 'Explore',
    links: [
      { to: '/destinations', label: 'Destinations' },
      { to: '/guides/things-to-do-in-meghalaya', label: 'Travel guides' },
      { to: '/guides/meghalaya-waterfalls', label: 'Meghalaya waterfalls' },
      { to: '/guides/places-to-visit-in-meghalaya', label: 'Places to visit' },
    ],
  },
  {
    title: 'XTSY',
    links: [
      { to: '/tab-bistro', label: 'TAB Bistro' },
      { to: '/tab-bistro/catering', label: 'Catering' },
      { to: '/about/merch', label: 'Merch' },
      { to: '/tours/destination-wedding-shillong', label: 'Destination weddings' },
      { to: '/stays/xtsy-vs-zostel', label: 'XTSY vs Zostel' },
      { to: '/stays/partner-stays', label: 'Become a partner stay' },
      { to: '/guides/meghalaya-festivals', label: 'Meghalaya festivals' },
      { to: '/about', label: 'About us' },
    ],
  },
  {
    title: 'Help',
    links: [
      { to: '/about/faq', label: 'FAQs' },
      { to: '/about/safety-house-rules', label: 'Safety & house rules' },
      { to: '/about/contact', label: 'Contact' },
      { to: '/about/pricing-cancellation-policy', label: 'Cancellation policy' },
      { to: '/about/privacy-policy', label: 'Privacy policy' },
      { to: '/about/terms-of-service', label: 'Terms of service' },
    ],
  },
];

const MAPS_URL = 'https://maps.google.com/maps?cid=8608608996389917352';

export default function SiteFooter() {
  return (
    <div className="xt">
      <Marquee
        className="bg-xt-crimson text-xt-paper"
        markFill="#F4EFE8"
        words={['Travel', 'Sleep', 'Binge', 'Work', 'Explore', 'Repeat', 'Meghalaya', 'New Shillong']}
      />
      <footer className="bg-xt-ink px-4 pb-8 pt-12 text-xt-fog sm:px-8 lg:px-14">
        <div className="grid gap-10 md:grid-cols-3 lg:grid-cols-7">
          <div className="flex flex-col gap-4 md:col-span-3 lg:col-span-2">
            <div className="flex items-center gap-3.5">
              <XtsyMark size={44} fill="#BD2E30" />
              <span className="font-display text-[40px] tracking-[0.15em] text-xt-paper">XTSY<sup className="text-[14px] tracking-normal">™</sup></span>
            </div>
            <address className="text-[14px] not-italic leading-relaxed">
              <strong className="text-xt-paper">XTSY Travellers Hostel</strong>
              <br />
              Mawdiangdiang Road, New Shillong Township, Shillong, Meghalaya – 793018
              <br />
              Near NIFT Shillong, IIM Shillong, NEIGRIHMS, NEIAH and Martin Luther Christian University
            </address>
            <p className="m-0 text-[13px] leading-relaxed text-[#9EA6B8]">
              XTSY currently holds this hostel and Shnonpedeng Riverside Camping by XTSY. Everywhere else, XTSY arranges stays, transport and travel help through trusted travel partners.
            </p>
            <p className="m-0 text-[14px] leading-loose">
              <a href="tel:+918837317070" className="inline-block py-1.5 text-xt-paper hover:text-xt-rose">{WHATSAPP_DISPLAY}</a>
              {' · '}
              <a href="mailto:booking@xtsy.one" className="inline-block py-1.5 text-xt-paper hover:text-xt-rose">booking@xtsy.one</a>
              <br />
              <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 text-xt-paper hover:text-xt-rose">Get directions</a>
            </p>
            <PlatformLogoStrip logos={SOCIAL_LOGOS} size={28} label="Follow us" showNames className="text-xt-paper" />
            <PlatformLogoStrip logos={LISTING_LOGOS} size={28} label="Find us on" className="text-xt-paper" />
          </div>
          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2.5">
              <div className="font-display text-[17px] tracking-[0.18em] text-xt-rose">{col.title}</div>
              {col.links.map((l) => (
                <Link key={l.to + l.label} to={l.to} className="inline-block py-1.5 text-[14px] text-[#E4D9C8] hover:text-white">
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-[#383D52] pt-5 text-[13px] text-[#A3ABC2] md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} XTSY™ is a trademark of, and is owned and operated by, XTSY Ventures Private Limited (trademark applications 8128622, 8128623 and 8128624 filed 18 Nov 2026), including XTSY Travellers Hostel · Experience by XTSY · TAB Bistro by XTSY · XTSY Voyage · Travel by XTSY</span>
          <span className="font-display text-[20px] tracking-[0.25em] text-xt-rose">Travel.Sleep.Binge</span>
        </div>
      </footer>
    </div>
  );
}
