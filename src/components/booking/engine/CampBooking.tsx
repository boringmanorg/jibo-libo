/**
 * Shnonpedeng riverside camping, booked through the XTSY desk on WhatsApp. Used by /book
 * (location=shnonpedeng) and /book/campsite. Owner rule: no live availability is shown; the desk
 * confirms every request on WhatsApp.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Handshake, MessageCircle, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addDays, daysBetween, todayInIndia, type IsoDate } from '@/booking/dates';
import { HOSTEL_POLICIES } from '@/data/hostelPolicies';
import { localEnquiryRef } from '@/lib/localEnquiry';
import { bookingPageSource, openWhatsAppDirectly } from '@/utils/privacyCompliantWhatsApp';
import { trackBookingStart } from '@/utils/dataLayerService';
import { CAMP, CAMP_GST_NOTE, CAMP_MEALS, CAMP_PHOTOS, CAMP_PLANS, campGuests, campProblem, campQuote, type CampMealId } from '@/data/shnonpedengCamp';
import { PhotoStrip } from './BookExtras';
import PropertyOverview from '@/components/booking/PropertyOverview';
import { recordEnquiryFn } from '@/booking/publicEngine.functions';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const MAX_UNITS = 10;
const field = 'h-12 w-full rounded-2xl border border-xt-line bg-white px-4 text-base text-xt-ink focus:outline-none focus:ring-2 focus:ring-xt-ink';

function Stepper({ value, min = 0, max, onChange, label }: { value: number; min?: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-xt-line bg-white text-xt-ink disabled:opacity-35"><Minus className="h-4 w-4" /></button>
      <output className="w-8 text-center text-lg font-extrabold text-xt-ink" aria-live="polite">{value}</output>
      <button type="button" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-xt-line bg-white text-xt-ink disabled:opacity-35"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

function Row({ title, sub, children }: { title: string; sub: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-xt-line bg-[#FBF8F3] p-5">
      <div className="min-w-0 flex-1">
        <p className="xt-display text-2xl leading-none text-xt-ink">{title}</p>
        <div className="mt-1.5 text-sm text-xt-mute">{sub}</div>
      </div>
      {children}
    </div>
  );
}

export default function CampBooking({ onBack }: { onBack?: () => void }) {
  const today = todayInIndia(new Date());
  const [checkIn, setCheckIn] = useState<IsoDate>(addDays(today, 1));
  const [checkOut, setCheckOut] = useState<IsoDate>(addDays(today, 2));
  const [tents, setTents] = useState(1);
  const [beds, setBeds] = useState(0);
  const [meals, setMeals] = useState<Record<CampMealId, number>>({ combo: 0, breakfast: 0, dinnerVeg: 0 });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sent, setSent] = useState('');
  const [tried, setTried] = useState(false);

  const nights = Math.max(0, daysBetween(checkIn, checkOut));
  const guests = campGuests({ tents, beds });
  const req = { nights, tents, beds, meals };
  const problem = campProblem(req);
  const quote = useMemo(() => campQuote(req), [nights, tents, beds, meals]); // eslint-disable-line react-hooks/exhaustive-deps
  const contactProblem = !name.trim() ? 'Add your name.' : phone.replace(/\D/g, '').length < 10 ? 'Add a phone number we can WhatsApp.' : null;

  const setMeal = (id: CampMealId, n: number) => setMeals((m) => ({ ...m, [id]: n }));
  const pickCheckIn = (v: IsoDate) => { setCheckIn(v); if (daysBetween(v, checkOut) < 1) setCheckOut(addDays(v, 1)); };
  const changeStay = (t: number, b: number) => {
    setTents(t); setBeds(b);
    const g = campGuests({ tents: t, beds: b });
    setMeals((m) => {
      let left = g;
      const next = { ...m };
      for (const id of Object.keys(next) as CampMealId[]) { next[id] = Math.min(next[id], left); left -= next[id]; }
      return next;
    });
  };

  const send = () => {
    setTried(true);
    if (problem || contactProblem) return;
    const ref = localEnquiryRef();
    const text = [
      `Hi XTSY, I'd like to book ${CAMP.name} (XTSY franchise partner).`,
      `Enquiry ID: ${ref}`,
      `Check-in ${checkIn}, check-out ${checkOut} (${nights} night${nights === 1 ? '' : 's'}), ${guests} guest${guests === 1 ? '' : 's'}.`,
      ...quote.lines.map((l) => `• ${l.label}: ${inr(l.amount)}`),
      `Estimated total: ${inr(quote.total)}`,
      `Name: ${name.trim()}; phone: ${phone.trim()}.`,
      notes.trim() && `Requests: ${notes.trim()}`,
      `Page: ${bookingPageSource()}`,
      'Please confirm availability.',
    ].filter(Boolean).join('\n');
    try { trackBookingStart(CAMP.name, quote.total, checkIn, checkOut, tents + beds); } catch { /* analytics is optional */ }
    openWhatsAppDirectly(text);
    setSent(ref);
    // Copy to the console inbox after WhatsApp has opened; never waits on or reports to the guest.
    void recordEnquiryFn({ data: {
      reference: ref, kind: 'camp', name: name.trim(), phone: phone.trim(), checkIn, checkOut, guests: Math.max(1, guests),
      summary: [`${CAMP.name}`, ...quote.lines.map((l) => `${l.label}: ${inr(l.amount)}`), notes.trim() && `Requests: ${notes.trim()}`].filter(Boolean).join(' | ').slice(0, 1500),
      estimate: quote.total,
    } }).catch(() => undefined);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8" aria-labelledby="camp-title">
      {onBack && <button type="button" onClick={onBack} className="mb-4 flex min-h-11 items-center gap-2 text-sm font-semibold text-xt-mute hover:text-xt-ink">← Change location</button>}
      <p className="flex w-fit items-center gap-2 rounded-full bg-xt-pine/10 px-3 py-1.5 text-sm font-bold text-xt-pine"><Handshake className="h-4 w-4" aria-hidden />{CAMP.partnerLine}</p>
      <h1 id="camp-title" className="xt-display mt-3 text-[clamp(3rem,9vw,6rem)] leading-[0.88] text-xt-ink">{CAMP.name}</h1>
      <p className="mt-3 text-base text-xt-mute">{CAMP.where}</p>
      <PhotoStrip photos={CAMP_PHOTOS} />
      <PropertyOverview propertyId="XTSY-SHN-CAMP" />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          <div>
            <h2 className="xt-display text-4xl text-xt-ink">Your dates</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-xt-ink">Check-in
                <input type="date" className={field} min={today} value={checkIn} onChange={(e) => e.target.value && pickCheckIn(e.target.value as IsoDate)} />
              </label>
              <label className="space-y-1 text-sm font-semibold text-xt-ink">Check-out
                <input type="date" className={field} min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => e.target.value && setCheckOut(e.target.value as IsoDate)} />
              </label>
            </div>
          </div>

          <p className="rounded-2xl bg-xt-oat p-4 text-sm font-semibold text-xt-ink">Send your dates on WhatsApp and the XTSY desk confirms whether tents are available.</p>

          <div className="space-y-3">
            <h2 className="xt-display text-4xl text-xt-ink">Tents</h2>
            <Row title={CAMP_PLANS.tent.title} sub={<><span className="font-bold text-xt-ink">{inr(CAMP_PLANS.tent.price)}</span> {CAMP_PLANS.tent.unit}. {CAMP_PLANS.tent.line}</>}>
              <Stepper label="Full tents" value={tents} max={MAX_UNITS} onChange={(n) => changeStay(n, beds)} />
            </Row>
            <Row title={CAMP_PLANS.bed.title} sub={<><span className="font-bold text-xt-ink">{inr(CAMP_PLANS.bed.price)}</span> {CAMP_PLANS.bed.unit}. {CAMP_PLANS.bed.line}</>}>
              <Stepper label="Bed spaces" value={beds} max={MAX_UNITS} onChange={(n) => changeStay(tents, n)} />
            </Row>
          </div>

          <div className="space-y-3">
            <h2 className="xt-display text-4xl text-xt-ink">Meals at the camp</h2>
            <p className="text-sm text-xt-mute">{CAMP.mealsNote} Choose one option per guest.</p>
            {(Object.values(CAMP_MEALS)).map((m) => {
              const max = guests - (Object.keys(meals) as CampMealId[]).filter((id) => id !== m.id).reduce((sum, id) => sum + meals[id], 0);
              return (
                <Row key={m.id} title={m.title} sub={<><span className="font-bold text-xt-ink">{inr(m.price)}</span> {m.unit}</>}>
                  <Stepper label={`${m.title} guests`} value={meals[m.id]} max={Math.max(0, max)} onChange={(n) => setMeal(m.id, n)} />
                </Row>
              );
            })}
          </div>

          <div className="space-y-3">
            <h2 className="xt-display text-4xl text-xt-ink">Your details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-xt-ink">Name
                <input className={field} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-semibold text-xt-ink">WhatsApp number
                <input className={field} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>
            <label className="block space-y-1 text-sm font-semibold text-xt-ink">Anything we should know (optional)
              <textarea className={cn(field, 'h-24 py-3')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
        </div>

        <aside className="lg:sticky lg:top-[140px] lg:self-start">
          <div className="rounded-[28px] bg-xt-night p-6 text-xt-sand">
            <p className="text-sm text-xt-fog">{nights} night{nights === 1 ? '' : 's'} · {guests} guest{guests === 1 ? '' : 's'}</p>
            <dl className="mt-4 space-y-2 border-b border-white/15 pb-4 text-sm">
              {quote.lines.map((l) => (
                <div key={l.label} className="flex justify-between gap-3"><dt className="text-xt-fog">{l.label}</dt><dd className="shrink-0 font-semibold">{inr(l.amount)}</dd></div>
              ))}
            </dl>
            <div className="mt-4 flex items-end justify-between"><span className="text-sm text-xt-fog">Estimated total</span><span className="xt-display text-5xl leading-none">{inr(quote.total)}</span></div>
            {tried && (problem || contactProblem) && <p role="alert" className="mt-4 rounded-2xl bg-xt-blush p-3 text-sm text-xt-crimson-dark">{problem ?? contactProblem}</p>}
            <button type="button" onClick={send} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-xt-crimson font-bold text-white">
              <MessageCircle className="h-5 w-5" aria-hidden /> Send to the desk on WhatsApp
            </button>
            <p className="mt-3 text-center text-xs text-xt-fog">{CAMP_GST_NOTE} The XTSY desk confirms availability and the final amount, then you pay the {HOSTEL_POLICIES.advancePercent}% advance. Non-refundable; one date change up to 14 days before check-in.</p>
            {sent && <p className="mt-3 rounded-2xl bg-white/10 p-3 text-sm">Sent with enquiry ID <span className="font-mono">{sent}</span>. If WhatsApp didn’t open, message +91 88373 17070 with this ID.</p>}
          </div>
          {onBack && (
            <button type="button" onClick={onBack} className="mt-4 flex min-h-11 items-center gap-2 text-sm font-semibold text-xt-mute hover:text-xt-ink">Prefer New Shillong? See the hostel <ArrowRight className="h-4 w-4" aria-hidden /></button>
          )}
        </aside>
      </div>
    </section>
  );
}
