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
import type { SmartRule } from '@/booking/smartPricing';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Users, X, Trash2, Flame, Coffee, PawPrint, Clock } from 'lucide-react';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatInr } from '@/booking/money';
import { addDays, daysBetween, todayInIndia, type IsoDate } from '@/booking/dates';
import { BOOKING_POLICY_TEXT, HOSTEL_POLICIES } from '@/data/hostelPolicies';
import { HOUSE_RULES } from '@/booking/houseRules';
import { roomContent } from '@/booking/roomContent';
import type { RoomResult, SearchResult } from '@/booking/publicEngine.core';
import { quoteFn, searchStaysFn } from '@/booking/publicEngine.functions';
import { staticDateProblem, staticQuote, staticSearch } from '@/booking/staticSearch';
import type { ClosureRow } from '@/booking/consoleClosures';
import type { SheetAvailability } from '@/booking/sheetAvailability';
import { BrandStory, LocationPicker, NEW_SHILLONG_PHOTOS, PhotoStrip, Promotions, type BookLocation } from './BookExtras';
import CampBooking from './CampBooking';
import { Details } from './StayDetails';
import { QuoteInputs, XtDialog, date, day, longDate, nightsLabel, type Cart, type EngineMode, type Line, type QuoteData } from './stayShared';
export type { EngineMode } from './stayShared';
import { LIVE_PROPERTY, sendLiveStage, useLiveStage } from '@/booking/liveStage';
import PropertyOverview from '@/components/booking/PropertyOverview';

type Filter = 'all' | 'bed' | 'room';

const unitWord = (r: { soldAs: 'bed' | 'room' }, n = 1) => (r.soldAs === 'bed' ? (n === 1 ? 'bed' : 'beds') : n === 1 ? 'room' : 'rooms');

const FACTS: { icon: typeof Clock; text: string }[] = [
  { icon: Clock, text: `Check-in ${HOSTEL_POLICIES.checkIn}, check-out ${HOSTEL_POLICIES.checkOut}` },
  { icon: Flame, text: 'Bonfire every night for in-house guests' },
  { icon: Coffee, text: 'TAB Bistro on the property' },
  { icon: PawPrint, text: 'Cats and birds welcome' },
];

export default function StayEngine({ hiddenRooms, mode, pending = false, photos, closures, sheet, pricing, initialLocation, initialDates }: { hiddenRooms?: string[]; mode: EngineMode; pricing?: SmartRule[]; /** Live counts not loaded yet: show placeholders, never rooms. */ pending?: boolean; photos?: Record<string, { src: string; alt: string }[]>; closures?: ClosureRow[]; sheet?: SheetAvailability; initialLocation?: BookLocation; initialDates?: { checkIn: IsoDate; checkOut: IsoDate } }) {
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
    if (pending) { setResult(null); return; } // counts on their way: placeholders only
    if (enquiry) {
      const problem = staticDateProblem(checkIn, checkOut);
      if (problem) { setResult(null); setError(problem); } else setResult(staticSearch(checkIn, checkOut, photos, closures, sheet, new Date(), pricing));
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
  }, [checkIn, checkOut, enquiry, closures, sheet, pricing, pending]);

  // Drop anything no longer free for the new dates.
  useEffect(() => {
    if (!result) return;
    setCart((c) => Object.fromEntries(Object.entries(c).filter(([id, v]) => (result.rooms.find((r) => r.id === id)?.freeForStay ?? 0) >= v.units)));
  }, [result]);

  const lines = useMemo(() => Object.entries(cart).map(([id, v]) => ({ room: result?.rooms.find((r) => r.id === id), ...v })).filter((l) => l.room), [cart, result]);
  const remove = (id: string) => setCart((c) => { const n = { ...c }; delete n[id]; return n; });
  const quoteInputs = useMemo(() => ({ closures, sheet, pricing }), [closures, sheet, pricing]);
  const roomQuote = useRoomQuote(result, cart, enquiry, quoteInputs);
  const setDates = (ci: IsoDate, co: IsoDate) => { setCheckIn(ci); setCheckOut(co > ci ? co : addDays(ci, 1)); };
  const shown = result?.rooms.filter((r) => !hiddenRooms?.includes(r.id) && (filter === 'all' || r.soldAs === filter)) ?? [];
  const toDetails = () => { setRulesOpen(false); setStep('details'); sendLiveStage(LIVE_PROPERTY.hostel, 'details'); window.scrollTo({ top: 0 }); };
  useLiveStage(LIVE_PROPERTY.hostel, 'view', mode !== 'preview' && location === 'new-shillong');
  useLiveStage(LIVE_PROPERTY.hostel, 'rooms', mode !== 'preview' && lines.length > 0);

  return (
    <QuoteInputs.Provider value={quoteInputs}>
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
          <CampBooking onBack={() => pickLocation(null)} />
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
                      className={cn('min-h-[48px] rounded-full px-4 text-sm font-semibold transition-colors', filter === k ? 'bg-xt-ink text-xt-sand' : 'text-xt-mute hover:text-xt-ink')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="mt-4 rounded-2xl border border-xt-crimson/30 bg-xt-blush p-4 text-sm text-xt-crimson-dark" role="alert">{error}</p>}
              {loading && !result && <RoomSkeletons />}
              {!loading && result?.suggestions && <NearestDates result={result} onPick={setDates} />}
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
    </QuoteInputs.Provider>
  );
}

function Hero({ onChangeLocation }: { onChangeLocation?: () => void }) {
  return (
    <header className="mx-auto max-w-6xl px-4 pt-8">
      {onChangeLocation && (
        <button type="button" onClick={onChangeLocation} className="mb-3 flex min-h-[48px] items-center gap-2 text-sm font-semibold text-xt-mute hover:text-xt-ink">← Change location</button>
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
      <PropertyOverview propertyId="XTSY-SHL-HOSTEL" />
    </header>
  );
}

function DateBar({ checkIn, checkOut, min, onChange }: { checkIn: IsoDate; checkOut: IsoDate; min: IsoDate; onChange: (ci: IsoDate, co: IsoDate) => void }) {
  const n = daysBetween(checkIn, checkOut);
  return (
    <div className="flex w-full items-center gap-2 rounded-full bg-xt-ink py-2 pl-5 pr-2 text-xt-sand md:w-auto md:gap-3">
      <label className="flex min-h-[48px] min-w-0 flex-1 flex-col justify-center text-[11px] text-xt-fog">
        Check-in
        <input type="date" className="w-full min-w-0 bg-transparent text-base font-semibold text-xt-sand [color-scheme:dark]" value={checkIn} min={min} max={addDays(min, 365)}
          onChange={(e) => e.target.value && onChange(e.target.value, checkOut)} />
      </label>
      <span aria-hidden className="h-8 w-px bg-xt-steel" />
      <label className="flex min-h-[48px] min-w-0 flex-1 flex-col justify-center text-[11px] text-xt-fog">
        Check-out
        <input type="date" className="w-full min-w-0 bg-transparent text-base font-semibold text-xt-sand [color-scheme:dark]" value={checkOut} min={addDays(checkIn, 1)} max={addDays(checkIn, 30)}
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
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 flex h-[48px] w-[48px] -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-xt-ink opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 top-1/2 flex h-[48px] w-[48px] -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-xt-ink opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"><ChevronRight className="h-5 w-5" /></button>
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
              className="flex min-h-[48px] items-center gap-2 rounded-full border border-xt-line px-4 text-sm font-semibold text-xt-ink hover:border-xt-stone">
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
                    <button type="button" className="flex h-[48px] w-[48px] items-center justify-center rounded-full hover:bg-xt-slate" onClick={() => setUnits(picked.units - 1)} aria-label={`One fewer ${unitWord(room)}`}><Minus className="h-4 w-4" /></button>
                    <span className="min-w-6 text-center font-bold" aria-live="polite">{picked.units}</span>
                    <button type="button" className="flex h-[48px] w-[48px] items-center justify-center rounded-full hover:bg-xt-slate disabled:opacity-40" disabled={picked.units >= maxUnits} onClick={() => setUnits(picked.units + 1)} aria-label={`One more ${unitWord(room)}`}><Plus className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <button type="button" className="min-h-[48px] rounded-full bg-xt-crimson px-6 text-sm font-bold text-white hover:bg-xt-crimson-dark" onClick={() => setUnits(1)}>Select {unitWord(room)}</button>
                )}
              </div>
            )}
          </div>

          {picked && room.soldAs === 'room' && room.maxGuestsPerUnit > 1 && (
            <label className="flex items-center justify-end gap-2 text-sm font-semibold text-xt-ink">
              Guests
              <select className="min-h-[48px] rounded-full border border-xt-line bg-white px-3" value={picked.guests}
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

/** Everything is full for the chosen dates: the closest stays of the same length that have space. */
function NearestDates({ result, onPick }: { result: SearchResult; onPick: (ci: IsoDate, co: IsoDate) => void }) {
  const list = result.suggestions ?? [];
  return (
    <div className="mt-6 rounded-[24px] border border-xt-line bg-white/70 p-5" role="status">
      <p className="font-semibold text-xt-ink">Every bed and room is taken for {nightsLabel(result.nights)} from {longDate(result.checkIn)}.</p>
      {list.length ? (
        <>
          <p className="mt-1 text-sm text-xt-mute">These dates nearby have space:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {list.map((s) => (
              <button key={s.checkIn} type="button" onClick={() => onPick(s.checkIn, s.checkOut)}
                className="min-h-[48px] rounded-full border border-xt-ink/20 bg-white px-4 text-left text-sm font-semibold text-xt-ink hover:border-xt-ink">
                {date(s.checkIn)} – {date(s.checkOut)} <span className="font-normal text-xt-mute">· from {formatInr(s.fromRate)}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-xt-mute">Nothing frees up within two weeks either. Try other dates, or message the desk on WhatsApp.</p>
      )}
    </div>
  );
}

function RoomSkeletons() {
  return <div className="mt-6 space-y-5">{[0, 1, 2].map((i) => <div key={i} className="h-60 animate-pulse rounded-[28px] bg-xt-oat" />)}</div>;
}

/** Quote for the room step (no breakfast, UPI): tax, grand total and the 25% payable now. */
function useRoomQuote(result: SearchResult | null, cart: Cart, enquiry: boolean, quoteInputs: { closures?: ClosureRow[]; sheet?: SheetAvailability; pricing?: SmartRule[] } = {}): QuoteData | null {
  const [q, setQ] = useState<QuoteData | null>(null);
  const key = JSON.stringify(cart);
  useEffect(() => {
    const rooms = Object.entries(cart).map(([roomTypeId, v]) => ({ roomTypeId, ...v }));
    if (!result || rooms.length === 0) { setQ(null); return; }
    if (enquiry) { setQ(staticQuote({ checkIn: result.checkIn, checkOut: result.checkOut, rooms, breakfast: [], method: 'upi' }, quoteInputs)); return; }
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
        <button type="button" className="min-h-[48px] rounded-full bg-xt-crimson px-7 font-bold text-white disabled:opacity-40" disabled={!lines.length} onClick={onContinue}>Book now</button>
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
                  <button type="button" onClick={() => onRemove(l.room!.id)} className="-mr-2 -mt-1.5 flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full text-xt-fog hover:bg-xt-slate hover:text-white" aria-label={`Remove ${l.room!.name}`}>
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
        <button type="button" className="min-h-[48px] w-full rounded-full bg-xt-crimson font-bold text-white hover:bg-[#B52B4E] disabled:cursor-not-allowed disabled:opacity-40" disabled={!lines.length} onClick={onContinue}>
          {lines.length ? 'Book now' : 'Select a bed or room'}
        </button>
        <p className="mt-3 text-center text-xs text-xt-fog">{BOOKING_POLICY_TEXT.short}</p>
      </div>
    </div>
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
      <button type="button" className="min-h-[48px] w-full rounded-full bg-xt-crimson font-bold text-white hover:bg-xt-crimson-dark" onClick={onContinue}>Continue to guest details</button>
    </XtDialog>
  );
}

