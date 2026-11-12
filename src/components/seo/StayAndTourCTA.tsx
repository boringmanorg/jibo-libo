import { useEffect, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { openWhatsApp } from '@/utils/privacyCompliantWhatsApp';
import { SATURDAY_GROUP_TOUR as T, nextSaturdayDepartures, formatDeparture } from '@/data/saturdayGroupTour';

/** "Stay & tour with XTSY": hostel base + Saturday group departure, WhatsApp enquiry only. */
export default function StayAndTourCTA({ place, showDates = false }: { place?: string; showDates?: boolean }) {
  const [dates, setDates] = useState<string[]>([]);
  useEffect(() => { setDates(nextSaturdayDepartures(new Date(), 6).map(formatDeparture)); }, []);
  return (
    <section aria-label="Stay and tour with XTSY" className="xt-reveal flex flex-col gap-4 rounded-[24px] border-[1.5px] border-xt-line bg-white p-7">
      <h2 className="m-0 text-[22px] font-extrabold">Stay &amp; tour with XTSY</h2>
      <p className="m-0 text-[16px] leading-relaxed text-xt-mute">
        Base yourself at <Link to="/best-hostel-in-shillong" className="font-bold text-xt-crimson">XTSY Travellers Hostel</Link> in New Shillong Township (dorm beds from ₹399 a night), or join the{' '}
        <Link to="/meghalaya-tour-packages" className="font-bold text-xt-crimson">Saturday group tour</Link>: {T.duration}, ₹{T.pricePerPerson.toLocaleString('en-IN')} per person, {T.schedule}, minimum {T.minGroup} guests.
        {place ? ` Ask us how to fit ${place} in.` : ''} Stays outside New Shillong are arranged through trusted partners.
      </p>
      {showDates && dates.length > 0 && (
        <p className="m-0 text-[15px] font-bold">Next departures: {dates.join(' · ')}</p>
      )}
      <button
        type="button"
        onClick={() => openWhatsApp(`Hi XTSY, I'd like to join the Meghalaya Saturday group tour${place ? ` (interested in ${place})` : ''}. Departure date: `)}
        className="xt-btn flex h-12 w-fit items-center rounded-full bg-xt-crimson px-6 text-[15px] font-extrabold text-white hover:text-white"
      >
        Enquire on WhatsApp
      </button>
    </section>
  );
}
