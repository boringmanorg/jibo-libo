/** Guest details and confirm step of the stay booking page. */
import { useContext } from 'react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, MessageCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatInr } from '@/booking/money';
import { PAYMENT_METHODS, type PaymentMethod } from '@/booking/payments/fees';
import { BOOKING_POLICY_TEXT, HOSTEL_POLICIES } from '@/data/hostelPolicies';
import { HOUSE_RULES } from '@/booking/houseRules';
import { roomContent } from '@/booking/roomContent';
import type { SearchResult } from '@/booking/publicEngine.core';
import { isIndian } from '@/booking/guestRules';
import { getBotCheckConfigFn, quoteFn, recordEnquiryFn, startCheckoutFn } from '@/booking/publicEngine.functions';
import { staticQuote } from '@/booking/staticSearch';
import { localEnquiryRef } from '@/lib/localEnquiry';
import { generateBookingMessage, bookingPageSource } from '@/utils/privacyCompliantWhatsApp';
import { trackBookingStart } from '@/utils/dataLayerService';
import { openWhatsAppDirectly } from '@/utils/privacyCompliantWhatsApp';
import { LIVE_PROPERTY, sendLiveStage } from '@/booking/liveStage';
import BreakfastPicker, { picksToList } from './BreakfastPicker';
import { breakfastItem } from '@/data/breakfastMenu';

import { QuoteInputs, XtDialog, date, longDate, nightsLabel, type Cart, type EngineMode, type Line, type QuoteData } from './stayShared';

const NATIONALITIES = ['India', 'Bangladesh', 'Bhutan', 'Nepal', 'Myanmar', 'Thailand', 'Malaysia', 'Singapore', 'Japan', 'South Korea', 'China', 'Australia', 'United Kingdom', 'United States', 'Canada', 'Germany', 'France', 'Netherlands', 'Spain', 'Italy', 'Israel', 'Russia', 'Other'];
const inputCls = 'min-h-[48px] w-full rounded-2xl border border-xt-line bg-white px-4 text-base text-xt-ink outline-none focus:border-xt-ink focus-visible:ring-2 focus-visible:ring-xt-ink/20';

export function Details({ mode, result, cart, lines, onBack }: { mode: EngineMode; result: SearchResult; cart: Cart; lines: Line[]; onBack: () => void }) {
  const quoteInputs = useContext(QuoteInputs);
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
    if (enquiry) { setQuote(staticQuote({ checkIn: result.checkIn, checkOut: result.checkOut, rooms, breakfast, method }, quoteInputs)); return; }
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
    sendLiveStage(LIVE_PROPERTY.hostel, 'contacted', reference);
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
          <button type="button" onClick={onBack} className="flex h-[48px] w-[48px] items-center justify-center rounded-full border border-xt-line bg-white text-xt-ink hover:border-xt-stone" aria-label="Back to rooms"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="xt-display text-5xl leading-none text-xt-ink sm:text-6xl">{enquiry ? 'Confirm & send' : 'Confirm & pay'}</h1>
        </div>

        <Panel title="Lead guest">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="g-name" label="Full name (as on ID)" required value={guest.name} onChange={(v) => setGuest({ ...guest, name: v })} autoComplete="name" />
            <Field id="g-email" label="Email for your receipt" required type="email" value={guest.email} onChange={(v) => setGuest({ ...guest, email: v })} autoComplete="email" />
            <div><Field id="g-phone" label="WhatsApp number" required type="tel" value={guest.phone} onChange={(v) => setGuest({ ...guest, phone: v })} autoComplete="tel" /><p className="mt-1.5 text-xs text-xt-mute">WhatsApp number only: the desk confirms your booking and shares updates on WhatsApp, so please use the number that has WhatsApp.</p></div>
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
                  <label key={g} className={cn('flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full border px-5 text-sm font-semibold capitalize has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-xt-ink/30', guest.gender === g ? 'border-xt-ink bg-xt-ink text-xt-sand' : 'border-xt-line bg-white text-xt-ink')}>
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
              <label key={m.id} className={cn('flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border px-4 text-sm font-semibold', method === m.id ? 'border-xt-ink bg-white text-xt-ink shadow-[0_0_0_1px_#1F2230]' : 'border-xt-line bg-white/60 text-xt-mute')}>
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
            <button type="submit" className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-xt-crimson font-bold text-white hover:bg-[#B52B4E] disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || !quote || !ready}>
              {enquiry ? <MessageCircle className="h-4 w-4" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
              {enquiry ? 'Send enquiry on WhatsApp' : busy ? 'Opening payment…' : quote ? `Confirm & pay ${formatInr(quote.advanceCharge.payable)}` : 'Confirm & pay'}
            </button>
            {sentRef && (
              <p className="rounded-2xl bg-xt-slate p-3 text-sm" role="status">
                Enquiry {sentRef} is ready in WhatsApp. Press send there to reach the desk; they confirm availability and share the payment link for the {HOSTEL_POLICIES.advancePercent}% advance.
              </p>
            )}
            {msg && <p className="rounded-2xl bg-xt-blush p-3 text-sm text-xt-crimson-dark" role="alert">{msg}</p>}
            {!enquiry && <button type="button" onClick={whatsapp} className="flex min-h-[48px] w-full items-center justify-center gap-2 text-sm text-xt-fog hover:text-white">
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
        <button type="button" className="min-h-[48px] rounded-full bg-xt-ink font-bold text-xt-sand" onClick={() => setMismatch(false)}>Got it</button>
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
    <div className="flex min-h-[48px] items-start gap-3 rounded-xl py-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5 h-6 w-6 shrink-0 border-xt-fog data-[state=checked]:border-xt-crimson data-[state=checked]:bg-xt-crimson" />
      <label htmlFor={id} className="flex-1 cursor-pointer py-0.5 leading-snug text-xt-sand">{children}<span className="text-xt-rose"> *</span></label>
    </div>
  );
}
