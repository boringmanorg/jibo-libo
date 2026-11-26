/**
 * XTSY booking engine page. Flow modelled on Zostel's stay page (photo-led header, room cards
 * with a 7-night strip, sticky summary, know-before-you-go, confirm & pay), dressed in XTSY's own
 * 2026 identity (.xt: sand, crimson, pine; Staatliches display, Manrope body) so it reads as the
 * same brand as the rest of xtsy.one.
 *
 * mode="live": guests can pay. mode="preview": the owner reviews the live page from the console;
 * payment is switched off. mode="enquiry": /book before online booking is live: the same page from
 * the static catalogue (no database, no availability counts), ending in a WhatsApp enquiry.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Users, X, MessageCircle, ArrowLeft, ShieldCheck, Trash2, Flame, Coffee, PawPrint, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatInr } from '@/booking/money';
import { addDays, daysBetween, todayInIndia, type IsoDate } from '@/booking/dates';
import { PAYMENT_METHODS, type PaymentMethod } from '@/booking/payments/fees';
import { BOOKING_POLICY_TEXT, HOSTEL_POLICIES } from '@/data/hostelPolicies';
import { HOUSE_RULES } from '@/booking/houseRules';
import { roomContent } from '@/booking/roomContent';
import type { RoomResult, SearchResult } from '@/booking/publicEngine.core';
import { isIndian } from '@/booking/guestRules';
import { getBotCheckConfigFn, quoteFn, recordEnquiryFn, searchStaysFn, startCheckoutFn } from '@/booking/publicEngine.functions';
import { staticDateProblem, staticQuote, staticSearch } from '@/booking/staticSearch';
import type { ClosureRow } from '@/booking/consoleClosures';
import type { SheetAvailability } from '@/booking/sheetAvailability';
import { localEnquiryRef } from '@/lib/localEnquiry';
import { generateBookingMessage, bookingPageSource } from '@/utils/privacyCompliantWhatsApp';
import { trackBookingStart } from '@/utils/dataLayerService';
import { openWhatsAppDirectly } from '@/utils/privacyCompliantWhatsApp';
import { BrandStory, LocationPicker, NEW_SHILLONG_PHOTOS, PhotoStrip, Promotions, type BookLocation } from './BookExtras';
import CampBooking from './CampBooking';
import BreakfastPicker, { picksToList } from './BreakfastPicker';
import { breakfastItem } from '@/data/breakfastMenu';

type Cart = Record<string, { units: number; guests: number }>;
type QuoteData = Awaited<ReturnType<typeof import('@/booking/publicEngine.core').quoteCheckout>>;
type Line = { room?: RoomResult; units: number; guests: number };
type Filter = 'all' | 'bed' | 'room';
export type EngineMode = 'live' | 'preview' | 'enquiry';

const utc = (d: IsoDate) => new Date(`${d}T00:00:00Z`);
const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' });
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const day = (d: IsoDate) => dayFmt.format(utc(d));
const date = (d: IsoDate) => dateFmt.format(utc(d));
const longDate = (d: IsoDate) => longDateFmt.format(utc(d));
const nightsLabel = (n: number) => `${n} night${n === 1 ? '' : 's'}`;
const unitWord = (r: { soldAs: 'bed' | 'room' }, n = 1) => (r.soldAs === 'bed' ? (n === 1 ? 'bed' : 'beds') : n === 1 ? 'room' : 'rooms');

const FACTS: { icon: typeof Clock; text: string }[] = [
  { icon: Clock, text: `Check-in ${HOSTEL_POLICIES.checkIn}, check-out ${HOSTEL_POLICIES.checkOut}` },
  { icon: Flame, text: 'Bonfire every night for in-house guests' },
  { icon: Coffee, text: 'TAB Bistro on the property' },
  { icon: PawPrint, text: 'Cats and birds welcome' },
];

export default function StayEngine({ mode, photos, closures, sheet, initialLocation, initialDates }: { mode: EngineMode; photos?: Record<string, { src: string; alt: string }[]>; closures?: ClosureRow[]; sheet?: SheetAvailability; initialLocation?: BookLocation; initialDates?: { checkIn: IsoDate; checkOut: IsoDate } }) {
  const [location, setLocation] = useState<BookLocation | null>(initialLocation ?? (mode === 'preview' ? 'new-shillong' : null));
  const pickLocation = (l: BookLocation | null) => {
    setLocation(l);
    try {
      const u = new URL(window.location.href);
      if (l) u.searchParams.set('location', l); else u.searchParams.delete('location');
      window.history.replaceState(window.history.state, '', u);
    } catch { /* URL update is cosmetic */ }
    window.scrollTo({ top: 0 });
  };
  const enquiry = mode === 'enquiry';
  const today = todayInIndia(new Date());
  // Dates from the home page's search (if valid and not in the past), else tonight.
  const startDates = initialDates && initialDates.checkIn >= today && initialDates.checkOut > initialDates.checkIn ? initialDates : null;
  const [checkIn, setCheckIn] = useState<IsoDate>(startDates?.checkIn ?? today);
  const [checkOut, setCheckOut] = useState<IsoDate>(startDates?.checkOut ?? addDays(today, 1));
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Cart>({});
  const [step, setStep] = useState<'rooms' | 'details'>('rooms');
  const [filter, setFilter] = useState<Filter>('all');
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError('');
    if (enquiry) {
      const problem = staticDateProblem(checkIn, checkOut);
      if (problem) { setResult(null); setError(problem); } else setResult(staticSearch(checkIn, checkOut, photos, closures, sheet));
      setLoading(false);
      return;
    }
    searchStaysFn({ data: { checkIn, checkOut } })
      .then((r) => {
        if (stale) return;
        if (r.ok) setResult(r.data);
        else { setResult(null); setError(r.error); }
      })
      .catch(() => !stale && setError('Rooms could not load. Check your connection and try again.'))
      .finally(() => !stale && setLoading(false));
    return () => { stale = true; };
  }, [checkIn, checkOut, enquiry, closures, sheet]);

  // Drop anything no longer free for the new dates.
  useEffect(() => {
    if (!result) return;
    setCart((c) => Object.fromEntries(Object.entries(c).filter(([id, v]) => (result.rooms.find((r) => r.id === id)?.freeForStay ?? 0) >= v.units)));
  }, [result]);

  const lines = useMemo(() => Object.entries(cart).map(([id, v]) => ({ room: result?.rooms.find((r) => r.id === id), ...v })).filter((l) => l.room), [cart, result]);
  const remove = (id: string) => setCart((c) => { const n = { ...c }; delete n[id]; return n; });
  const roomQuote = useRoomQuote(result, cart, enquiry);
  const setDates = (ci: IsoDate, co: IsoDate) => { setCheckIn(ci); setCheckOut(co > ci ? co : addDays(ci, 1)); };
  const shown = result?.rooms.filter((r) => filter === 'all' || r.soldAs === filter) ?? [];
  const toDetails = () => { setRulesOpen(false); setStep('details'); window.scrollTo({ top: 0 }); };

  return (
    <div className="xt min-h-screen pb-32 lg:pb-16">
      {mode === 'preview' && (
        <p className="mx-auto max-w-6xl px-4 pt-4 text-sm text-xt-mute" role="note">
          <span className="rounded-full bg-xt-ink px-2.5 py-1 text-xs font-semibold text-xt-sand">Preview</span>{' '}
          Guests see this page at /book once the launch switch is on; payment is off here.
          {result && !result.inventorySynced && ' Counts come from the Google Sheet and console blocks until a channel manager or PMS is connected.'}
        </p>
      )}

      {location === null ? (
        <>
          <LocationPicker onPick={pickLocation} />
          <BrandStory />
        </>
      ) : location === 'shnonpedeng' ? (
        <>
          <CampBooking onBack={() => pickLocation(null)} closures={closures} />
          <Promotions step={1} />
          <BrandStory />
        </>
      ) : step === 'rooms' ? (
        <>
          <Hero onChangeLocation={mode === 'preview' ? undefined : () => pickLocation(null)} />
          <div className="mx-auto mt-10 grid max-w-6xl gap-8 px-4 lg:grid-cols-[1fr_360px]">
            <section aria-labelledby="select-room" className="min-w-0">
              <h2 id="select-room" className="xt-display text-4xl text-xt-ink">Choose your bed or room</h2>
              {enquiry && <p className="mt-1 text-sm text-xt-mute">Pick what you’d like and send it to the desk on WhatsApp. The desk confirms availability, then you pay the {HOSTEL_POLICIES.advancePercent}% advance.</p>}
              <div className="-mx-4 mt-3 md:sticky md:top-[124px] md:z-30 flex flex-col gap-3 border-b border-xt-line bg-[#F6F1EA] px-4 py-3 shadow-[0_8px_16px_-12px_rgba(31,34,48,.35)] md:flex-row md:items-center md:justify-between lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:shadow-none">
                <DateBar checkIn={checkIn} checkOut={checkOut} min={today} onChange={setDates} />
                <div className="inline-flex w-fit rounded-full border border-xt-line bg-white/60 p-1" role="tablist" aria-label="Room type">
                  {([['all', 'All stays'], ['bed', 'Dorm beds'], ['room', 'Private rooms']] as const).map(([k, label]) => (
                    <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
                      className={cn('min-h-12 rounded-full px-4 text-sm font-semibold transition-colors', filter === k ? 'bg-xt-ink text-xt-sand' : 'text-xt-mute hover:text-xt-ink')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="mt-4 rounded-2xl border border-xt-crimson/30 bg-xt-blush p-4 text-sm text-xt-crimson-dark" role="alert">{error}</p>}
              {loading && !result && <RoomSkeletons />}
              <div className={cn('mt-6 space-y-5 transition-opacity', loading && result && 'opacity-50')} aria-busy={loading}>
                {shown.map((r) => (
                  <RoomCard key={r.id} room={r} enquiry={enquiry} picked={cart[r.id]}
                    onPick={(v) => setCart((c) => { const n = { ...c }; if (v) n[r.id] = v; else delete n[r.id]; return n; })} />
                ))}
              </div>
            </section>

            <aside className="hidden lg:block">
              <div className="sticky top-6">
                <Summary enquiry={enquiry} result={result} lines={lines} quote={roomQuote} onRemove={remove} onContinue={() => setRulesOpen(true)} />
              </div>
            </aside>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-40 bg-xt-night p-4 text-xt-sand shadow-[0_-12px_32px_rgba(31,34,48,.25)] lg:hidden">
            <Summary enquiry={enquiry} compact result={result} lines={lines} quote={roomQuote} onRemove={remove} onContinue={() => setRulesOpen(true)} />
          </div>
          <KnowBeforeYouGo open={rulesOpen} onOpenChange={setRulesOpen} onContinue={toDetails} />
          <BrandStory />
          <Promotions step={1} />
        </>
      ) : (
        result && (
          <>
            <Details mode={mode} result={result} cart={cart} lines={lines} onBack={() => setStep('rooms')} />
            <Promotions step={2} />
          </>
        )
      )}
    </div>
  );
}

function Hero({ onChangeLocation }: { onChangeLocation?: () => void }) {
  return (
    <header className="mx-auto max-w-6xl px-4 pt-8">
      {onChangeLocation && (
        <button type="button" onClick={onChangeLocation} className="mb-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-xt-mute hover:text-xt-ink">← Change location</button>
      )}
      <div className="xt-in">
        <h1 className="xt-display text-[clamp(3rem,9vw,6.5rem)] leading-[0.88] text-xt-ink">XTSY Travellers Hostel</h1>
        <p className="mt-3 text-base text-xt-mute">Mawdiangdiang Road, New Shillong Township, Meghalaya</p>
      </div>
      <PhotoStrip photos={NEW_SHILLONG_PHOTOS} />
      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-xt-ink">
        {FACTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2"><Icon className="h-4 w-4 text-xt-pine" aria-hidden />{text}</li>
        ))}
      </ul>
    </header>
  );
}

function DateBar({ checkIn, checkOut, min, onChange }: { checkIn: IsoDate; checkOut: IsoDate; min: IsoDate; onChange: (ci: IsoDate, co: IsoDate) => void }) {
  const n = daysBetween(checkIn, checkOut);
  return (
    <div className="flex w-full items-center gap-2 rounded-full bg-xt-ink py-2 pl-5 pr-2 text-xt-sand md:w-auto md:gap-3">
      <label className="flex min-w-0 flex-1 flex-col text-[11px] text-xt-fog">
        Check-in
        <input type="date" className="w-full min-w-0 bg-transparent text-sm font-semibold text-xt-sand [color-scheme:dark]" value={checkIn} min={min} max={addDays(min, 365)}
          onChange={(e) => e.target.value && onChange(e.target.value, checkOut)} />
      </label>
      <span aria-hidden className="h-8 w-px bg-xt-steel" />
      <label className="flex min-w-0 flex-1 flex-col text-[11px] text-xt-fog">
        Check-out
        <input type="date" className="w-full min-w-0 bg-transparent text-sm font-semibold text-xt-sand [color-scheme:dark]" value={checkOut} min={addDays(checkIn, 1)} max={addDays(checkIn, 30)}
          onChange={(e) => e.target.value && onChange(checkIn, e.target.value)} />
      </label>
      <span className="shrink-0 whitespace-nowrap rounded-full bg-xt-crimson px-3 py-1.5 text-xs font-bold">{nightsLabel(n)}</span>
    </div>
  );
}

function PhotoCarousel({ images, alt, dim }: { images: string[]; alt: string; dim: boolean }) {
  const [i, setI] = useState(0);
  if (!images.length) {
    return <div className="flex h-full min-h-56 items-center justify-center bg-xt-oat text-sm text-xt-mute">Photos coming soon</div>;
  }
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length);
  return (
    <div className="group relative h-full min-h-56">
      <img src={images[i]} alt={`${alt}, photo ${i + 1} of ${images.length}`} loading="lazy" className={cn('absolute inset-0 h-full w-full object-cover', dim && 'grayscale')} />
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-xt-ink opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-xt-ink opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"><ChevronRight className="h-5 w-5" /></button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
            {images.slice(0, 6).map((_, k) => <span key={k} className={cn('h-1.5 rounded-full bg-white transition-all', k === i ? 'w-6' : 'w-1.5 opacity-60')} />)}
          </div>
        </>
      )}
    </div>
  );
}

function RoomCard({ room, enquiry, picked, onPick }: { room: RoomResult; enquiry: boolean; picked?: { units: number; guests: number }; onPick: (v: { units: number; guests: number } | null) => void }) {
  const [open, setOpen] = useState(false);
  const content = roomContent(room.id);
  const images = room.photos?.length ? room.photos.map((p) => p.src) : content.images;
  const soldOut = room.freeForStay === 0;
  // Enquiry mode has no booking counts; it shows counts only where the console has closed some.
  const showCount = (free: number) => !enquiry || (room.totalUnits !== undefined && free < room.totalUnits);
  const maxUnits = Math.min(room.freeForStay, room.soldAs === 'bed' ? 8 : 3);
  const setUnits = (u: number) => {
    if (u <= 0) return onPick(null);
    const units = Math.min(u, maxUnits);
    onPick({ units, guests: room.soldAs === 'bed' ? units : Math.min(Math.max(picked?.guests ?? units * room.maxGuestsPerUnit, units), units * room.maxGuestsPerUnit) });
  };

  return (
    <article className={cn('overflow-hidden rounded-[28px] border bg-[#FBF8F3] transition-shadow', picked ? 'border-xt-crimson shadow-[0_0_0_1px_#A12444]' : 'border-xt-line')} aria-label={room.name}>
      <div className="grid sm:grid-cols-[280px_1fr]">
        <div className="relative aspect-[4/3] sm:aspect-auto">
          <PhotoCarousel images={images} alt={room.name} dim={soldOut} />
          {room.femaleOnly && <span className="absolute left-3 top-3 rounded-full bg-xt-rose px-3 py-1 text-xs font-bold text-white">Female only</span>}
        </div>
        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="xt-display text-[1.75rem] leading-none text-xt-ink">{room.name}</h3>
              {room.descriptor && <p className="mt-1 text-sm font-semibold text-xt-pine">{room.descriptor}</p>}
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-xt-cream px-2.5 py-1 text-sm font-semibold text-xt-ink" title={`Up to ${room.maxGuestsPerUnit} per ${unitWord(room)}`}>
              <Users className="h-4 w-4" aria-hidden /> {room.maxGuestsPerUnit}<span className="sr-only"> guests per {unitWord(room)}</span>
            </span>
          </div>
          <p className="text-[15px] leading-relaxed text-xt-mute">{content.blurb}</p>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-2">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`strip-${room.id}`}
              className="flex min-h-11 items-center gap-2 rounded-full border border-xt-line px-4 text-sm font-semibold text-xt-ink hover:border-xt-stone">
              <CalendarDays className="h-4 w-4" aria-hidden /> {enquiry ? 'Prices, next 7 nights' : 'Next 7 nights'} <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
            </button>
            {soldOut ? (
              <span className="rounded-full bg-xt-oat px-5 py-2.5 text-sm font-bold text-xt-mute">Sold out for these dates</span>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="leading-tight"><span className="text-2xl font-extrabold text-xt-ink">{formatInr(room.fromRate)}</span><span className="text-sm text-xt-mute"> / night</span></p>
                  <p className="text-xs text-xt-mute">per {unitWord(room)}, plus GST</p>
                  {showCount(room.freeForStay) && room.freeForStay <= 2 && <p className="text-xs font-bold text-xt-crimson">Only {room.freeForStay} {unitWord(room, room.freeForStay)} left</p>}
                </div>
                {picked ? (
                  <div className="flex items-center rounded-full bg-xt-ink text-xt-sand" role="group" aria-label={`${unitWord(room, 2)} selected`}>
                    <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-xt-slate" onClick={() => setUnits(picked.units - 1)} aria-label={`One fewer ${unitWord(room)}`}><Minus className="h-4 w-4" /></button>
                    <span className="min-w-6 text-center font-bold" aria-live="polite">{picked.units}</span>
                    <button type="button" className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-xt-slate disabled:opacity-40" disabled={picked.units >= maxUnits} onClick={() => setUnits(picked.units + 1)} aria-label={`One more ${unitWord(room)}`}><Plus className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <button type="button" className="min-h-12 rounded-full bg-xt-crimson px-6 text-sm font-bold text-white hover:bg-xt-crimson-dark" onClick={() => setUnits(1)}>Select {unitWord(room)}</button>
                )}
              </div>
            )}
          </div>

          {picked && room.soldAs === 'room' && room.maxGuestsPerUnit > 1 && (
            <label className="flex items-center justify-end gap-2 text-sm font-semibold text-xt-ink">
              Guests
              <select className="min-h-11 rounded-full border border-xt-line bg-white px-3" value={picked.guests}
                onChange={(e) => onPick({ units: picked.units, guests: Number(e.target.value) })}>
                {Array.from({ length: picked.units * room.maxGuestsPerUnit - picked.units + 1 }, (_, i) => picked.units + i).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      {open && (
        <div id={`strip-${room.id}`} className="grid grid-cols-7 gap-1 border-t border-xt-line bg-xt-sand p-2 text-center text-xs sm:gap-2 sm:p-3">
          {room.strip.map((n) => {
            const ok = n.free > 0 && !n.closed;
            return (
              <div key={n.night} className={cn('rounded-2xl px-1 py-2.5', ok ? 'bg-white' : 'bg-transparent')}>
                <p className="text-xt-mute">{day(n.night)}</p>
                <p className="font-bold text-xt-ink">{date(n.night)}</p>
                {ok ? (
                  <>
                    <p className="mt-1 font-bold text-xt-leaf">{formatInr(n.rate)}</p>
                    {showCount(n.free) && <p className="text-xt-mute">{n.free} left</p>}
                  </>
                ) : (
                  <>
                    <X className="mx-auto mt-1 h-4 w-4 text-xt-crimson" aria-label="Not available" />
                    <p className="text-xt-mute">Full</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function RoomSkeletons() {
  return <div className="mt-6 space-y-5">{[0, 1, 2].map((i) => <div key={i} className="h-60 animate-pulse rounded-[28px] bg-xt-oat" />)}</div>;
}

/** Quote for the room step (no breakfast, UPI): tax, grand total and the 25% payable now. */
function useRoomQuote(result: SearchResult | null, cart: Cart, enquiry: boolean): QuoteData | null {
  const [q, setQ] = useState<QuoteData | null>(null);
  const key = JSON.stringify(cart);
  useEffect(() => {
    const rooms = Object.entries(cart).map(([roomTypeId, v]) => ({ roomTypeId, ...v }));
    if (!result || rooms.length === 0) { setQ(null); return; }
    if (enquiry) { setQ(staticQuote({ checkIn: result.checkIn, checkOut: result.checkOut, rooms, breakfast: [], method: 'upi' })); return; }
    let stale = false;
    quoteFn({ data: { checkIn: result.checkIn, checkOut: result.checkOut, rooms, breakfast: [], method: 'upi' } })
      .then((r) => !stale && setQ(r.ok ? r.data : null))
      .catch(() => !stale && setQ(null));
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.checkIn, result?.checkOut, key, enquiry]);
  return q;
}

function Summary({ enquiry, result, lines, quote, onRemove, onContinue, compact }: {
  enquiry: boolean; result: SearchResult | null; lines: Line[]; quote: QuoteData | null; onRemove: (id: string) => void; onContinue: () => void; compact?: boolean;
}) {
  const nights = result?.nights ?? 1;
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          {lines.length && quote ? (
            <><span className="text-xt-fog">{enquiry ? 'Advance ' : 'Pay now '}</span><span className="text-lg font-extrabold">{formatInr(quote.quote.advance)}</span>
              <span className="block text-xs text-xt-fog">Total {formatInr(quote.quote.total)} with GST, {nightsLabel(nights)}</span></>
          ) : result?.fromRate != null ? <>From <span className="text-lg font-extrabold">{formatInr(result.fromRate)}</span> a night</> : 'Nothing free for these dates'}
        </div>
        <button type="button" className="min-h-12 rounded-full bg-xt-crimson px-7 font-bold text-white disabled:opacity-40" disabled={!lines.length} onClick={onContinue}>Book now</button>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[28px] bg-xt-night text-xt-sand">
      <div className="p-6">
        {!lines.length ? (
          <>
            {result?.fromRate != null ? (
              <p><span className="text-sm text-xt-fog">From</span><br /><span className="xt-display text-6xl leading-none">{formatInr(result.fromRate)}</span><span className="text-sm text-xt-fog"> a night</span></p>
            ) : (
              <p className="xt-display text-3xl">{result ? 'Fully booked for these dates' : 'Finding rooms'}</p>
            )}
            <p className="mt-4 text-sm text-xt-fog">Pick a bed or room to see your total.</p>
          </>
        ) : (
          <>
            <h2 className="xt-display text-3xl">Your stay</h2>
            {result && <p className="text-sm text-xt-fog">{nightsLabel(nights)} from {longDate(result.checkIn)}</p>}
            <ul className="mt-5 space-y-4">
              {lines.map((l) => (
                <li key={l.room!.id} className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-semibold leading-snug">{l.room!.name} × {l.units}</p>
                    <p className="text-sm text-xt-fog">{formatInr(l.room!.fromRate)} × {nightsLabel(nights)}</p>
                  </div>
                  <span className="pt-0.5 font-semibold">{formatInr(l.room!.fromRate * l.units * nights)}</span>
                  <button type="button" onClick={() => onRemove(l.room!.id)} className="-mr-2 -mt-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xt-fog hover:bg-xt-slate hover:text-white" aria-label={`Remove ${l.room!.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {lines.length > 0 && (
        <div className="border-t border-dashed border-xt-steel p-6 pt-5">
          {quote ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-xt-fog"><dt>GST</dt><dd>{formatInr(quote.quote.gst)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatInr(quote.quote.total)}</dd></div>
              <div className="mt-3 flex items-end justify-between rounded-2xl bg-xt-slate p-4">
                <dt><span className="block text-xs text-xt-fog">{enquiry ? `Advance (${HOSTEL_POLICIES.advancePercent}%)` : `Pay now (${HOSTEL_POLICIES.advancePercent}%)`}</span><span className="text-xs text-xt-fog">{enquiry ? 'after the desk confirms' : 'rest at check-in'}</span></dt>
                <dd className="xt-display text-4xl leading-none">{formatInr(quote.quote.advance)}</dd>
              </div>
            </dl>
          ) : <p className="text-sm text-xt-fog">Working out your total…</p>}
        </div>
      )}
      <div className="px-6 pb-6">
        <button type="button" className="min-h-12 w-full rounded-full bg-xt-crimson font-bold text-white hover:bg-[#B52B4E] disabled:cursor-not-allowed disabled:opacity-40" disabled={!lines.length} onClick={onContinue}>
          {lines.length ? 'Book now' : 'Select a bed or room'}
        </button>
        <p className="mt-3 text-center text-xs text-xt-fog">{BOOKING_POLICY_TEXT.short}</p>
      </div>
    </div>
  );
}

function XtDialog({ open, onOpenChange, children, className }: { open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('rounded-[28px] border-xt-line bg-xt-sand font-[Manrope,system-ui,sans-serif] text-xt-ink', className)}>{children}</DialogContent>
    </Dialog>
  );
}

function KnowBeforeYouGo({ open, onOpenChange, onContinue }: { open: boolean; onOpenChange: (o: boolean) => void; onContinue: () => void }) {
  return (
    <XtDialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogHeader>
        <DialogTitle className="xt-display text-4xl font-normal text-xt-ink">Know before you go</DialogTitle>
        <DialogDescription className="text-xt-mute">House rules at XTSY Travellers Hostel</DialogDescription>
      </DialogHeader>
      <dl className="max-h-[50vh] divide-y divide-xt-line overflow-y-auto">
        {HOUSE_RULES.map((r) => (
          <div key={r.label} className="grid grid-cols-[96px_1fr] gap-3 py-3">
            <dt className="text-sm font-bold text-xt-ink">{r.label}</dt>
            <dd className="text-sm text-xt-mute">{r.value}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="min-h-12 w-full rounded-full bg-xt-crimson font-bold text-white hover:bg-xt-crimson-dark" onClick={onContinue}>Continue to guest details</button>
    </XtDialog>
  );
}

const NATIONALITIES = ['India', 'Bangladesh', 'Bhutan', 'Nepal', 'Myanmar', 'Thailand', 'Malaysia', 'Singapore', 'Japan', 'South Korea', 'China', 'Australia', 'United Kingdom', 'United States', 'Canada', 'Germany', 'France', 'Netherlands', 'Spain', 'Italy', 'Israel', 'Russia', 'Other'];
const inputCls = 'min-h-12 w-full rounded-2xl border border-xt-line bg-white px-4 text-base text-xt-ink outline-none focus:border-xt-ink focus-visible:ring-2 focus-visible:ring-xt-ink/20';

function Details({ mode, result, cart, lines, onBack }: { mode: EngineMode; result: SearchResult; cart: Cart; lines: Line[]; onBack: () => void }) {
  const totalGuests = lines.reduce((s, l) => s + l.guests, 0);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const breakfast = picksToList(picks);
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [guest, setGuest] = useState({ name: '', phone: '', email: '', gender: '' as '' | 'female' | 'male' | 'other', nationality: 'India', otherNationality: '' });
  const [policy, setPolicy] = useState(false);
  const [female, setFemale] = useState(false);
  const [sky, setSky] = useState(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [botRequired, setBotRequired] = useState(false);
  const rooms = Object.entries(cart).map(([roomTypeId, v]) => ({ roomTypeId, ...v }));
  const femaleBeds = lines.filter((l) => l.room?.femaleOnly).reduce((s, l) => s + l.units, 0);
  const needsSky = lines.some((l) => l.room?.id === 'experience-by-xtsy');
  const nationality = guest.nationality === 'Other' ? guest.otherNationality : guest.nationality;
  const foreign = nationality.trim() !== '' && !isIndian(nationality);
  const enquiry = mode === 'enquiry';
  const [sentRef, setSentRef] = useState('');

  useEffect(() => {
    if (enquiry) { setQuote(staticQuote({ checkIn: result.checkIn, checkOut: result.checkOut, rooms, breakfast, method })); return; }
    let stale = false;
    quoteFn({ data: { checkIn: result.checkIn, checkOut: result.checkOut, rooms, breakfast, method } })
      .then((r) => !stale && (r.ok ? setQuote(r.data) : setMsg(r.error)));
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(breakfast), method, result.checkIn, result.checkOut, JSON.stringify(cart)]);

  const ready = policy && guest.gender !== '' && (!needsSky || sky) && (femaleBeds <= 1 || female) && (enquiry || !botRequired || botToken !== '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (femaleBeds > 0 && guest.gender !== 'female') return setMismatch(true);
    if (enquiry) return sendEnquiry();
    if (mode === 'preview') return setMsg('Preview only: payment opens when the launch switch is on.');
    setBusy(true);
    setMsg('');
    const r = await startCheckoutFn({ data: {
      checkIn: result.checkIn, checkOut: result.checkOut, rooms, breakfast, method,
      guest: { name: guest.name, phone: guest.phone, email: guest.email, gender: guest.gender as 'female' | 'male' | 'other', nationality },
      policyAccepted: policy, femaleOnlyAck: female, skyViewAck: sky, botToken: botToken || undefined,
    } }).catch(() => ({ ok: false as const, error: 'The booking service did not respond. Check your connection and try again.' }));
    if (r.ok) { window.location.assign(r.data.redirectUrl); return; }
    setBusy(false);
    setMsg(r.error);
    setBotToken('');
    resetBotCheck();
  };

  /** Enquiry mode: open WhatsApp on the guest's click with everything filled in. */
  const sendEnquiry = () => {
    if (!quote) return;
    const tab = window.open('', '_blank');
    const reference = localEnquiryRef();
    const source = bookingPageSource();
    const roomsText = lines.map((l) => `${l.units}× ${l.room!.name} (${formatInr(l.room!.fromRate)}/night plus GST)`).join(', ');
    const extras = [
      `Lead guest: ${guest.gender}, ${nationality}`,
      breakfast.length > 0 && `TAB Bistro breakfast each morning: ${breakfast.map((b) => `${b.qty} × ${breakfastItem(b.item)?.name ?? b.item}`).join(', ')}`,
      `Advance (${HOSTEL_POLICIES.advancePercent}%) after confirmation: ${formatInr(quote.quote.advance)}`,
      needsSky && 'Understood: sky view depends on the weather and is not guaranteed',
      'Accepted the cancellation and property policies',
    ].filter(Boolean).join(' | ');
    const message = generateBookingMessage({
      roomType: roomsText, guests: totalGuests, checkIn: result.checkIn, checkOut: result.checkOut, nights: result.nights,
      totalPrice: Math.round(quote.quote.total / 100), guestName: guest.name, email: guest.email, phone: guest.phone,
      specialRequests: extras, reference, source,
    });
    try {
      trackBookingStart(lines[0]?.room?.name ?? 'Multiple', Math.round(quote.quote.total / 100), result.checkIn, result.checkOut, lines.reduce((s, l) => s + l.units, 0));
    } catch { /* analytics is optional */ }
    const url = `https://wa.me/918837317070?text=${encodeURIComponent(message)}`;
    if (tab && !tab.closed) { tab.opener = null; tab.location.href = url; } else openWhatsAppDirectly(message);
    setSentRef(reference);
    // Copy to the console inbox after WhatsApp has opened; never waits on or reports to the guest.
    void recordEnquiryFn({ data: {
      reference, kind: 'stay', name: guest.name.trim(), phone: guest.phone.trim(), checkIn: result.checkIn, checkOut: result.checkOut,
      guests: totalGuests, summary: [roomsText, extras].join(' | ').slice(0, 1500), estimate: Math.round(quote.quote.total / 100),
    } }).catch(() => undefined);
  };

  const whatsapp = () => openWhatsAppDirectly(
    `Hi XTSY, I'd like to book ${lines.map((l) => `${l.units} × ${l.room!.name}`).join(', ')} from ${date(result.checkIn)} to ${date(result.checkOut)} (${totalGuests} guest${totalGuests > 1 ? 's' : ''}).`,
  );

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-6xl gap-8 px-4 pt-8 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0 space-y-8">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="flex h-12 w-12 items-center justify-center rounded-full border border-xt-line bg-white text-xt-ink hover:border-xt-stone" aria-label="Back to rooms"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="xt-display text-5xl leading-none text-xt-ink sm:text-6xl">{enquiry ? 'Confirm & send' : 'Confirm & pay'}</h1>
        </div>

        <Panel title="Lead guest">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="g-name" label="Full name (as on ID)" required value={guest.name} onChange={(v) => setGuest({ ...guest, name: v })} autoComplete="name" />
            <Field id="g-email" label="Email for your receipt" required type="email" value={guest.email} onChange={(v) => setGuest({ ...guest, email: v })} autoComplete="email" />
            <Field id="g-phone" label="Mobile number (WhatsApp)" required type="tel" value={guest.phone} onChange={(v) => setGuest({ ...guest, phone: v })} autoComplete="tel" />
            <div className="space-y-1.5">
              <label htmlFor="g-nat" className="text-sm font-semibold text-xt-ink">Nationality<span className="text-xt-crimson"> *</span></label>
              <select id="g-nat" className={inputCls} value={guest.nationality} onChange={(e) => setGuest({ ...guest, nationality: e.target.value })}>
                {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {guest.nationality === 'Other' && <Field id="g-nat-other" label="Your nationality" required value={guest.otherNationality} onChange={(v) => setGuest({ ...guest, otherNationality: v })} />}
            <fieldset className="space-y-1.5 sm:col-span-2">
              <legend className="text-sm font-semibold text-xt-ink">Gender<span className="text-xt-crimson"> *</span></legend>
              <div className="flex flex-wrap gap-2">
                {(['female', 'male', 'other'] as const).map((g) => (
                  <label key={g} className={cn('flex min-h-12 cursor-pointer items-center gap-2 rounded-full border px-5 text-sm font-semibold capitalize has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-xt-ink/30', guest.gender === g ? 'border-xt-ink bg-xt-ink text-xt-sand' : 'border-xt-line bg-white text-xt-ink')}>
                    <input type="radio" name="gender" value={g} className="sr-only" checked={guest.gender === g} onChange={() => setGuest({ ...guest, gender: g })} required /> {g}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          {foreign && <p className="mt-4 rounded-2xl bg-xt-cream p-4 text-sm text-xt-ink">Please carry your passport and visa. The desk files Form C within 24 hours of your arrival.</p>}
        </Panel>

        <Panel title="Breakfast at TAB Bistro">
          <BreakfastPicker picks={picks} onChange={setPicks} mornings={result.nights} />
        </Panel>

        {!enquiry && <Panel title="Pay the advance with">
          <div className="grid gap-2 sm:grid-cols-2">
            {PAYMENT_METHODS.filter((m) => m.id !== 'wallet').map((m) => (
              <label key={m.id} className={cn('flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 text-sm font-semibold', method === m.id ? 'border-xt-ink bg-white text-xt-ink shadow-[0_0_0_1px_#1F2230]' : 'border-xt-line bg-white/60 text-xt-mute')}>
                <input type="radio" name="method" value={m.id} className="accent-[#A12444]" checked={method === m.id} onChange={() => setMethod(m.id)} /> {m.label}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-xt-mute">Indian cards, UPI and net banking. The gateway charge for your method shows in the summary.</p>
        </Panel>}

        <div className="divide-y divide-xt-line border-y border-xt-line">
          <details className="group py-2">
            <summary className="xt-display flex min-h-14 cursor-pointer list-none items-center justify-between text-3xl text-xt-ink">Cancellation policy <ChevronDown className="h-6 w-6 transition-transform group-open:rotate-180" aria-hidden /></summary>
            <ul className="mb-4 list-disc space-y-1.5 pl-5 text-[15px] text-xt-mute">
              <li>{BOOKING_POLICY_TEXT.cancellation}</li>
              <li>{BOOKING_POLICY_TEXT.dateChange}</li>
              <li>Full refund only if XTSY cannot provide the room you booked.</li>
            </ul>
          </details>
          <details className="group py-2">
            <summary className="xt-display flex min-h-14 cursor-pointer list-none items-center justify-between text-3xl text-xt-ink">Property policy <ChevronDown className="h-6 w-6 transition-transform group-open:rotate-180" aria-hidden /></summary>
            <dl className="mb-4 divide-y divide-xt-line">
              {[...HOUSE_RULES, { label: 'Rates', value: 'Exclude breakfast, GST and payment gateway charges.' }].map((r) => (
                <div key={r.label} className="grid grid-cols-[110px_1fr] gap-3 py-2.5 text-[15px]"><dt className="font-bold text-xt-ink">{r.label}</dt><dd className="text-xt-mute">{r.value}</dd></div>
              ))}
            </dl>
          </details>
        </div>
      </section>

      <aside>
        <div className="sticky top-6 overflow-hidden rounded-[28px] bg-xt-night text-xt-sand">
          <div className="p-6">
            <h2 className="xt-display text-3xl">Your stay</h2>
            <p className="text-sm text-xt-fog">{nightsLabel(result.nights)} from {longDate(result.checkIn)}, {totalGuests} guest{totalGuests === 1 ? '' : 's'}</p>
            <ul className="mt-5 space-y-3">
              {lines.map((l) => {
                const img = l.room!.photos?.[0]?.src ?? roomContent(l.room!.id).images[0];
                return (
                  <li key={l.room!.id} className="flex gap-3">
                    {img ? <img src={img} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-2xl bg-xt-slate" />}
                    <div className="flex-1 text-sm">
                      <p className="font-semibold leading-snug">{l.room!.name} × {l.units}</p>
                      <p className="flex justify-between text-xt-fog"><span>{formatInr(l.room!.fromRate)} × {nightsLabel(result.nights)}</span><span className="text-xt-sand">{formatInr(l.room!.fromRate * l.units * result.nights)}</span></p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="border-t border-dashed border-xt-steel p-6 pt-5">
            {quote ? (
              <dl className="space-y-2 text-sm">
                {quote.quote.lines.filter((l) => l.label.startsWith('Breakfast')).map((l) => (
                  <div key={l.label} className="flex justify-between gap-3 text-xt-fog"><dt>{l.label.replace(/^Breakfast: /, 'Breakfast, ')}</dt><dd className="shrink-0">{formatInr(l.taxable)}</dd></div>
                ))}
                <div className="flex justify-between gap-3 text-xt-fog"><dt>Stay total</dt><dd>{formatInr(quote.quote.taxable)}</dd></div>
                <div className="flex justify-between gap-3 text-xt-fog"><dt>GST</dt><dd>{formatInr(quote.quote.gst)}</dd></div>
                <div className="flex justify-between gap-3 text-base font-semibold"><dt>Total</dt><dd>{formatInr(quote.quote.total)}</dd></div>
                <div className="flex justify-between gap-3 text-xt-fog"><dt>Advance ({HOSTEL_POLICIES.advancePercent}%)</dt><dd>{formatInr(quote.quote.advance)}</dd></div>
                {enquiry ? (
                  <div className="mt-3 flex items-end justify-between rounded-2xl bg-xt-slate p-4">
                    <dt className="text-xs text-xt-fog">Advance after the desk confirms<span className="block">{formatInr(quote.quote.balance)} at check-in</span></dt>
                    <dd className="xt-display text-4xl leading-none">{formatInr(quote.quote.advance)}</dd>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between gap-3 text-xt-fog"><dt>Gateway charge with GST</dt><dd>{formatInr(quote.advanceCharge.gatewayCharge + quote.advanceCharge.gstOnCharge)}</dd></div>
                    <div className="mt-3 flex items-end justify-between rounded-2xl bg-xt-slate p-4">
                      <dt className="text-xs text-xt-fog">Pay now<span className="block">{formatInr(quote.quote.balance)} at check-in</span></dt>
                      <dd className="xt-display text-4xl leading-none">{formatInr(quote.advanceCharge.payable)}</dd>
                    </div>
                  </>
                )}
              </dl>
            ) : <p className="text-sm text-xt-fog">Working out your total…</p>}
          </div>
          <div className="space-y-3 px-6 pb-6 text-sm">
            <Ack id="ack-policy" checked={policy} onChange={setPolicy}>I accept the cancellation and property policies.</Ack>
            {femaleBeds > 1 && <Ack id="ack-female" checked={female} onChange={setFemale}>Every guest in the female deluxe dorm is female.</Ack>}
            {needsSky && <Ack id="ack-sky" checked={sky} onChange={setSky}>I understand the suite’s sky view depends on the weather and is not guaranteed.</Ack>}
            {!enquiry && <BotCheck onToken={setBotToken} onRequired={setBotRequired} />}
            <button type="submit" className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-xt-crimson font-bold text-white hover:bg-[#B52B4E] disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || !quote || !ready}>
              {enquiry ? <MessageCircle className="h-4 w-4" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
              {enquiry ? 'Send enquiry on WhatsApp' : busy ? 'Opening payment…' : quote ? `Confirm & pay ${formatInr(quote.advanceCharge.payable)}` : 'Confirm & pay'}
            </button>
            {sentRef && (
              <p className="rounded-2xl bg-xt-slate p-3 text-sm" role="status">
                Enquiry {sentRef} is ready in WhatsApp. Press send there to reach the desk; they confirm availability and share the payment link for the {HOSTEL_POLICIES.advancePercent}% advance.
              </p>
            )}
            {msg && <p className="rounded-2xl bg-xt-blush p-3 text-sm text-xt-crimson-dark" role="alert">{msg}</p>}
            {!enquiry && <button type="button" onClick={whatsapp} className="flex min-h-11 w-full items-center justify-center gap-2 text-sm text-xt-fog hover:text-white">
              <MessageCircle className="h-4 w-4" aria-hidden /> Prefer to talk? WhatsApp the desk
            </button>}
          </div>
        </div>
      </aside>

      <XtDialog open={mismatch} onOpenChange={setMismatch} className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="xt-display text-center text-4xl font-normal text-xt-ink">Gender mismatch</DialogTitle>
          <DialogDescription className="text-center text-base text-xt-mute">
            You chose {femaleBeds} bed{femaleBeds > 1 ? 's' : ''} in the female-only dorm, but the lead guest is not female. Change the lead guest’s gender or choose another room.
          </DialogDescription>
        </DialogHeader>
        <button type="button" className="min-h-12 rounded-full bg-xt-ink font-bold text-xt-sand" onClick={() => setMismatch(false)}>Got it</button>
      </XtDialog>
    </form>
  );
}

type TurnstileApi = { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void; reset: (id?: string) => void };
const turnstile = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;
const resetBotCheck = () => { try { turnstile()?.reset(); } catch { /* widget not shown */ } };

/** Cloudflare Turnstile widget; renders nothing when the bot check is not set up on the server. */
function BotCheck({ onToken, onRequired }: { onToken: (t: string) => void; onRequired: (r: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  useEffect(() => {
    getBotCheckConfigFn().then((r) => { setSiteKey(r.siteKey); onRequired(Boolean(r.siteKey)); }).catch(() => onRequired(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!siteKey || !box.current) return;
    let id: string | undefined;
    const render = () => {
      const t = turnstile();
      if (!t || !box.current || id) return;
      id = t.render(box.current, { sitekey: siteKey, theme: 'dark', size: 'flexible', callback: (tok: string) => onToken(tok), 'expired-callback': () => onToken(''), 'error-callback': () => onToken('') });
    };
    if (turnstile()) render();
    else {
      let s = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
      if (!s) {
        s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.dataset.turnstile = '1';
        document.head.appendChild(s);
      }
      s.addEventListener('load', render);
    }
    return () => { if (id) turnstile()?.remove(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);
  if (!siteKey) return null;
  return <div ref={box} className="min-h-[65px]" aria-label="Security check" />;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-xt-line bg-[#FBF8F3] p-5 sm:p-6">
      <h2 className="xt-display mb-4 text-3xl text-xt-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ id, label, value, onChange, required, type = 'text', autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; autoComplete?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-xt-ink">{label}{required && <span className="text-xt-crimson"> *</span>}</label>
      <input id={id} type={type} className={inputCls} value={value} required={required} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Ack({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-start gap-3 rounded-xl py-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5 h-6 w-6 shrink-0 border-xt-fog data-[state=checked]:border-xt-crimson data-[state=checked]:bg-xt-crimson" />
      <label htmlFor={id} className="flex-1 cursor-pointer py-0.5 leading-snug text-xt-sand">{children}<span className="text-xt-rose"> *</span></label>
    </div>
  );
}
