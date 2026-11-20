/**
 * XTSY booking engine page, modelled on Zostel's stay page: a date bar, one card per room type
 * with its price per bed or room, what is left for the stay and a 7-night strip, and a summary
 * that turns into guest details and a 25% advance payment.
 *
 * mode="live": guests can pay. mode="preview": the owner reviews the page from the console;
 * search works, payment is switched off.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, Minus, Plus, Users, X, MessageCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatInr } from '@/booking/money';
import { addDays, todayInIndia, type IsoDate } from '@/booking/dates';
import { PAYMENT_METHODS, type PaymentMethod } from '@/booking/payments/fees';
import { BOOKING_POLICY_TEXT, HOSTEL_POLICIES } from '@/data/hostelPolicies';
import { roomContent } from '@/booking/roomContent';
import type { RoomResult, SearchResult } from '@/booking/publicEngine.core';
import { quoteFn, searchStaysFn, startCheckoutFn } from '@/booking/publicEngine.functions';
import { openWhatsAppDirectly } from '@/utils/privacyCompliantWhatsApp';

type Cart = Record<string, { units: number; guests: number }>;
type QuoteData = Awaited<ReturnType<typeof import('@/booking/publicEngine.core').quoteCheckout>>;

const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' });
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const day = (d: IsoDate) => dayFmt.format(new Date(`${d}T00:00:00Z`));
const date = (d: IsoDate) => dateFmt.format(new Date(`${d}T00:00:00Z`));
const unitWord = (r: { soldAs: 'bed' | 'room' }, n = 1) => (r.soldAs === 'bed' ? (n === 1 ? 'bed' : 'beds') : n === 1 ? 'room' : 'rooms');

export default function StayEngine({ mode }: { mode: 'live' | 'preview' }) {
  const today = todayInIndia(new Date());
  const [checkIn, setCheckIn] = useState<IsoDate>(today);
  const [checkOut, setCheckOut] = useState<IsoDate>(addDays(today, 1));
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Cart>({});
  const [step, setStep] = useState<'rooms' | 'details'>('rooms');

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setError('');
    searchStaysFn({ data: { checkIn, checkOut } })
      .then((r) => {
        if (stale) return;
        if (r.ok) setResult(r.data);
        else { setResult(null); setError(r.error); }
      })
      .catch(() => !stale && setError('Could not load rooms. Please try again.'))
      .finally(() => !stale && setLoading(false));
    return () => { stale = true; };
  }, [checkIn, checkOut]);

  // Drop anything no longer free for the new dates.
  useEffect(() => {
    if (!result) return;
    setCart((c) => Object.fromEntries(Object.entries(c).filter(([id, v]) => (result.rooms.find((r) => r.id === id)?.freeForStay ?? 0) >= v.units)));
  }, [result]);

  const lines = useMemo(() => Object.entries(cart).map(([id, v]) => ({ room: result?.rooms.find((r) => r.id === id), ...v })).filter((l) => l.room), [cart, result]);
  const setDates = (ci: IsoDate, co: IsoDate) => {
    setCheckIn(ci);
    setCheckOut(co > ci ? co : addDays(ci, 1));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-6 md:pb-12">
      {mode === 'preview' && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200" role="note">
          Preview. Guests see this page at /book only once the launch switch is on; payment is off here.
          {result && !result.inventorySynced && ' Counts below are XTSY’s own bookings only until STAAH is connected (OTA sales are not included yet).'}
        </p>
      )}

      {step === 'rooms' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section aria-labelledby="select-room">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 id="select-room" className="text-3xl font-semibold">Select room</h1>
                <p className="mt-1 text-sm text-muted-foreground">XTSY Travellers Hostel, New Shillong Township · check-in {HOSTEL_POLICIES.checkIn} · check-out {HOSTEL_POLICIES.checkOut}</p>
              </div>
              <DateBar checkIn={checkIn} checkOut={checkOut} min={today} onChange={setDates} />
            </div>

            {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">{error}</p>}
            {loading && !result && <RoomSkeletons />}
            <div className={cn('space-y-4', loading && result && 'opacity-60')} aria-busy={loading}>
              {result?.rooms.map((r) => (
                <RoomCard key={r.id} room={r} nights={result.nights} picked={cart[r.id]}
                  onPick={(v) => setCart((c) => { const n = { ...c }; if (v) n[r.id] = v; else delete n[r.id]; return n; })} />
              ))}
            </div>
          </section>

          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <Summary result={result} lines={lines} onContinue={() => setStep('details')} />
            </div>
          </aside>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur lg:hidden">
            <Summary compact result={result} lines={lines} onContinue={() => setStep('details')} />
          </div>
        </div>
      ) : (
        result && <Details mode={mode} result={result} cart={cart} lines={lines} onBack={() => setStep('rooms')} />
      )}
    </div>
  );
}

function DateBar({ checkIn, checkOut, min, onChange }: { checkIn: IsoDate; checkOut: IsoDate; min: IsoDate; onChange: (ci: IsoDate, co: IsoDate) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2">
      <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <label className="flex flex-col text-xs text-muted-foreground">
        Check-in
        <input type="date" className="bg-transparent text-base font-medium text-foreground" value={checkIn} min={min} max={addDays(min, 365)}
          onChange={(e) => e.target.value && onChange(e.target.value, checkOut)} />
      </label>
      <span aria-hidden className="text-muted-foreground">→</span>
      <label className="flex flex-col text-xs text-muted-foreground">
        Check-out
        <input type="date" className="bg-transparent text-base font-medium text-foreground" value={checkOut} min={addDays(checkIn, 1)} max={addDays(checkIn, 30)}
          onChange={(e) => e.target.value && onChange(checkIn, e.target.value)} />
      </label>
    </div>
  );
}

function RoomCard({ room, nights, picked, onPick }: { room: RoomResult; nights: number; picked?: { units: number; guests: number }; onPick: (v: { units: number; guests: number } | null) => void }) {
  const [open, setOpen] = useState(false);
  const content = roomContent(room.id);
  const soldOut = room.freeForStay === 0;
  const maxUnits = Math.min(room.freeForStay, room.soldAs === 'bed' ? 8 : 3);
  const setUnits = (u: number) => {
    if (u <= 0) return onPick(null);
    const units = Math.min(u, maxUnits);
    onPick({ units, guests: room.soldAs === 'bed' ? units : Math.min(Math.max(picked?.guests ?? units * room.maxGuestsPerUnit, units), units * room.maxGuestsPerUnit) });
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card" aria-label={room.name}>
      <div className="flex flex-col sm:flex-row">
        <div className={cn('relative aspect-[4/3] w-full shrink-0 bg-muted sm:aspect-auto sm:w-64', soldOut && 'grayscale')}>
          {content.images[0] ? (
            <img src={content.images[0]} alt={room.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">Photos coming soon</div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold leading-snug">{room.name}</h2>
              {room.descriptor && <p className="text-sm text-muted-foreground">{room.descriptor}</p>}
            </div>
            <span className="flex shrink-0 items-center gap-1 text-sm" title={`Up to ${room.maxGuestsPerUnit} per ${unitWord(room)}`}>
              {room.maxGuestsPerUnit} <Users className="h-4 w-4" aria-label="guests" />
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{content.blurb}</p>
          {room.femaleOnly && <span className="w-fit rounded-full border border-pink-400/50 px-2 py-0.5 text-xs text-pink-300">Female guests only</span>}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`strip-${room.id}`}
              className="flex min-h-11 items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground">
              <CalendarDays className="h-4 w-4" aria-hidden /> Next 7 nights {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
            </button>
            {soldOut ? (
              <span className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">Sold out</span>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p><span className="text-lg font-semibold">{formatInr(room.fromRate)}</span> <span className="text-sm text-muted-foreground">/ night {room.soldAs === 'bed' ? 'per bed' : 'per room'}</span></p>
                  {room.freeForStay <= 2 && <p className="text-xs font-medium text-orange-400">Only {room.freeForStay} {unitWord(room, room.freeForStay)} left</p>}
                  {nights > 1 && <p className="text-xs text-muted-foreground">+ GST</p>}
                </div>
                {picked ? (
                  <div className="flex items-center gap-1 rounded-full border border-border" role="group" aria-label={`${unitWord(room, 2)} selected`}>
                    <Button type="button" size="icon" variant="ghost" className="h-11 w-11 rounded-full" onClick={() => setUnits(picked.units - 1)} aria-label={`One fewer ${unitWord(room)}`}><Minus className="h-4 w-4" /></Button>
                    <span className="min-w-6 text-center font-medium" aria-live="polite">{picked.units}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-11 w-11 rounded-full" disabled={picked.units >= maxUnits} onClick={() => setUnits(picked.units + 1)} aria-label={`One more ${unitWord(room)}`}><Plus className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <Button type="button" className="min-h-11 rounded-full" onClick={() => setUnits(1)}>Select {unitWord(room)}</Button>
                )}
              </div>
            )}
          </div>

          {picked && room.soldAs === 'room' && room.maxGuestsPerUnit > 1 && (
            <label className="flex items-center justify-end gap-2 text-sm">
              Guests
              <select className="min-h-11 rounded-md border border-border bg-background px-2" value={picked.guests}
                onChange={(e) => onPick({ units: picked.units, guests: Number(e.target.value) })}>
                {Array.from({ length: picked.units * room.maxGuestsPerUnit - picked.units + 1 }, (_, i) => picked.units + i).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      {open && (
        <div id={`strip-${room.id}`} className="grid grid-cols-7 border-t border-border text-center text-xs">
          {room.strip.map((n) => (
            <div key={n.night} className="px-1 py-3">
              <p className="text-muted-foreground">{day(n.night)}</p>
              <p className="font-medium">{date(n.night)}</p>
              {n.free > 0 && !n.closed ? (
                <>
                  <p className="mt-1 font-semibold text-emerald-400">{formatInr(n.rate)}</p>
                  <p className="text-muted-foreground">{n.free} left</p>
                </>
              ) : (
                <>
                  <X className="mx-auto mt-1 h-4 w-4 text-red-500" aria-label="Not available" />
                  <p className="text-muted-foreground">0 left</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function RoomSkeletons() {
  return <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}</div>;
}

type Line = { room?: RoomResult; units: number; guests: number };

function Summary({ result, lines, onContinue, compact }: { result: SearchResult | null; lines: Line[]; onContinue: () => void; compact?: boolean }) {
  const nightly = lines.reduce((s, l) => s + (l.room?.fromRate ?? 0) * l.units, 0);
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          {lines.length ? <><span className="font-semibold">{formatInr(nightly * (result?.nights ?? 1))}</span> <span className="text-muted-foreground">+ GST · {result?.nights} night(s)</span></>
            : result?.fromRate != null ? <>From <span className="font-semibold">{formatInr(result.fromRate)}</span> / night</> : 'No rooms free for these dates'}
        </div>
        <Button className="min-h-12 rounded-full px-6" disabled={!lines.length} onClick={onContinue}>Continue</Button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {result?.fromRate != null ? (
        <p className="text-2xl font-semibold">From {formatInr(result.fromRate)} <span className="text-sm font-normal text-muted-foreground">/ night</span></p>
      ) : (
        <p className="text-lg font-semibold">{result ? 'Fully booked for these dates' : 'Loading…'}</p>
      )}
      {lines.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {lines.map((l) => (
            <li key={l.room!.id} className="flex justify-between gap-3">
              <span>{l.room!.name} × {l.units}</span>
              <span>{formatInr(l.room!.fromRate * l.units * (result?.nights ?? 1))}</span>
            </li>
          ))}
          <li className="text-xs text-muted-foreground">{result?.nights} night(s) · GST added at the next step</li>
        </ul>
      )}
      <Button className="mt-4 min-h-12 w-full rounded-full" disabled={!lines.length} onClick={onContinue}>
        {lines.length ? 'Continue' : 'Select rooms'}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">{BOOKING_POLICY_TEXT.payment}</p>
    </div>
  );
}

function Details({ mode, result, cart, lines, onBack }: { mode: 'live' | 'preview'; result: SearchResult; cart: Cart; lines: Line[]; onBack: () => void }) {
  const totalGuests = lines.reduce((s, l) => s + l.guests, 0);
  const [breakfast, setBreakfast] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [guest, setGuest] = useState({ name: '', phone: '', email: '', nationality: 'Indian' });
  const [policy, setPolicy] = useState(false);
  const [female, setFemale] = useState(false);
  const [sky, setSky] = useState(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const rooms = Object.entries(cart).map(([roomTypeId, v]) => ({ roomTypeId, ...v }));
  const needsFemale = lines.some((l) => l.room?.femaleOnly);
  const needsSky = lines.some((l) => l.room?.id === 'experience-by-xtsy');

  useEffect(() => {
    let stale = false;
    quoteFn({ data: { checkIn: result.checkIn, checkOut: result.checkOut, rooms, breakfastGuests: breakfast, method } })
      .then((r) => !stale && (r.ok ? setQuote(r.data) : setMsg(r.error)));
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakfast, method, result.checkIn, result.checkOut, JSON.stringify(cart)]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'preview') return setMsg('Preview only: payment opens when the launch switch is on.');
    setBusy(true);
    setMsg('');
    const r = await startCheckoutFn({ data: {
      checkIn: result.checkIn, checkOut: result.checkOut, rooms, breakfastGuests: breakfast, method,
      guest: { name: guest.name, phone: guest.phone, email: guest.email || undefined, nationality: guest.nationality || undefined },
      policyAccepted: policy, femaleOnlyAck: female, skyViewAck: sky,
    } }).catch(() => ({ ok: false as const, error: 'Could not reach the booking service. Please try again.' }));
    if (r.ok) { window.location.assign(r.data.redirectUrl); return; }
    setBusy(false);
    setMsg(r.error);
  };

  const whatsapp = () => openWhatsAppDirectly(
    `Hi XTSY, I'd like to book ${lines.map((l) => `${l.units} × ${l.room!.name}`).join(', ')} from ${date(result.checkIn)} to ${date(result.checkOut)} (${totalGuests} guest${totalGuests > 1 ? 's' : ''}).`,
  );

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6">
        <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Change rooms or dates</button>
        <h1 className="text-3xl font-semibold">Guest details</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="g-name" label="Full name (as on ID)" required value={guest.name} onChange={(v) => setGuest({ ...guest, name: v })} autoComplete="name" />
          <Field id="g-phone" label="Phone (WhatsApp)" required type="tel" value={guest.phone} onChange={(v) => setGuest({ ...guest, phone: v })} autoComplete="tel" />
          <Field id="g-email" label="Email (for your receipt)" type="email" value={guest.email} onChange={(v) => setGuest({ ...guest, email: v })} autoComplete="email" />
          <Field id="g-nat" label="Nationality" value={guest.nationality} onChange={(v) => setGuest({ ...guest, nationality: v })} />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Breakfast from TAB Bistro (₹280 per person per morning + GST)</legend>
          <select className="min-h-11 rounded-md border border-border bg-background px-3" value={breakfast} onChange={(e) => setBreakfast(Number(e.target.value))} aria-label="Guests taking breakfast">
            {Array.from({ length: totalGuests + 1 }, (_, i) => <option key={i} value={i}>{i === 0 ? 'No breakfast' : `${i} guest${i > 1 ? 's' : ''}`}</option>)}
          </select>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">How will you pay the advance?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PAYMENT_METHODS.filter((m) => m.id !== 'wallet').map((m) => (
              <label key={m.id} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm', method === m.id ? 'border-primary' : 'border-border')}>
                <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} /> {m.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Indian cards, UPI and net banking. The gateway charge for your method is shown in the summary.</p>
        </fieldset>

        <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
          <p className="font-medium">Booking policy</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>{BOOKING_POLICY_TEXT.payment}</li>
            <li>{BOOKING_POLICY_TEXT.cancellation}</li>
            <li>{BOOKING_POLICY_TEXT.dateChange}</li>
            <li>Rates exclude breakfast, GST and payment gateway charges.</li>
          </ul>
          <Ack id="ack-policy" checked={policy} onChange={setPolicy}>I accept the booking policy.</Ack>
          {needsFemale && <Ack id="ack-female" checked={female} onChange={setFemale}>The female deluxe dorm bed is for a female guest.</Ack>}
          {needsSky && <Ack id="ack-sky" checked={sky} onChange={setSky}>I understand the suite’s sky view depends on the weather and is not guaranteed.</Ack>}
        </div>
      </section>

      <aside>
        <div className="sticky top-24 space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{date(result.checkIn)} → {date(result.checkOut)} · {result.nights} night(s) · {totalGuests} guest(s)</p>
          {quote ? (
            <dl className="space-y-2 text-sm">
              {quote.quote.lines.map((l) => (
                <div key={l.label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{l.label}</dt><dd>{formatInr(l.taxable)}</dd></div>
              ))}
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">GST</dt><dd>{formatInr(quote.quote.gst)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 font-medium"><dt>Booking total</dt><dd>{formatInr(quote.quote.total)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Advance ({HOSTEL_POLICIES.advancePercent}%)</dt><dd>{formatInr(quote.quote.advance)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Gateway charge + 18% GST</dt><dd>{formatInr(quote.advanceCharge.gatewayCharge + quote.advanceCharge.gstOnCharge)}</dd></div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold"><dt>Pay now</dt><dd>{formatInr(quote.advanceCharge.payable)}</dd></div>
              <div className="flex justify-between gap-3 text-muted-foreground"><dt>At check-in ({HOSTEL_POLICIES.balancePercent}%)</dt><dd>{formatInr(quote.quote.balance)}</dd></div>
            </dl>
          ) : <p className="text-sm text-muted-foreground">Calculating…</p>}
          <Button type="submit" className="min-h-12 w-full rounded-full" disabled={busy || !quote}>
            <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
            {busy ? 'Opening payment…' : quote ? `Pay ${formatInr(quote.advanceCharge.payable)} securely` : 'Pay advance'}
          </Button>
          {msg && <p className="text-sm text-destructive" role="alert">{msg}</p>}
          <button type="button" onClick={whatsapp} className="flex min-h-11 w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <MessageCircle className="h-4 w-4" aria-hidden /> Prefer to talk? WhatsApp the desk
          </button>
        </div>
      </aside>
    </form>
  );
}

function Field({ id, label, value, onChange, required, type = 'text', autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; autoComplete?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input id={id} type={type} className="min-h-11 text-base" value={value} required={required} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Ack({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <Label htmlFor={id} className="font-normal leading-snug">{children}</Label>
    </div>
  );
}
