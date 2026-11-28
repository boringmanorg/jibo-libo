import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, Download, FileCheck2, FileText, Globe2, LockKeyhole, ScanLine, Upload, UserRound, Wifi } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { cn } from '@/lib/utils';
import {
  CHECK_IN_FILE_ACCEPT, CHECK_IN_POLICY_VERSION, CHECK_IN_PROPERTIES, CHECK_IN_PURPOSES, MAX_CHECK_IN_UPLOAD_BYTES, REFERRAL_SOURCES,
  arrivalFromOpen, LATEST_CHECK_OUT, checkInPolicies, checkOutProblem, clientFileProblem, requiredDocumentKeys, roomPreferences, validateCheckInDetails,
  type CheckInPropertyId, type DocumentMode,
} from '@/checkin/checkInModel';
import { getGuestCheckInFn, submitCheckInFn } from '@/checkin/checkIn.functions';

const STEPS = ['Property', 'Your details', 'Documents', 'Room preference', 'Policies'] as const;
const field = 'min-h-[48px] w-full rounded-2xl border border-xt-line bg-xt-paper px-4 text-base text-xt-ink outline-none focus:ring-2 focus:ring-xt-ink';
const button = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-base font-extrabold disabled:cursor-not-allowed disabled:opacity-45';

type DocumentLinks = Record<string, { viewUrl: string; downloadUrl: string }>;
type Receipt = { id: string; accessToken: string };
type GuestReceipt = { checkIn: { documentList: { key: string; label: string }[]; guestName: string; propertyId: CheckInPropertyId; roomTypeId: string; checkInDate: string; checkInTime: string; totalGuests: number }; documents: DocumentLinks };

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block space-y-2 text-sm font-bold text-xt-ink"><span>{label}</span>{children}{hint && <span className="block text-xs font-normal text-xt-mute">{hint}</span>}</label>;
}

function ModeToggle({ value, onChange, label }: { value: DocumentMode; onChange: (m: DocumentMode) => void; label: string }) {
  return <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
    {([['separate', 'Front and back'], ['single', 'One document']] as const).map(([m, text]) => <button key={m} type="button" role="radio" aria-checked={value === m} onClick={() => onChange(m)} className={cn('min-h-[48px] rounded-2xl border-2 px-3 text-sm font-bold', value === m ? 'border-xt-ink bg-xt-sand text-xt-ink' : 'border-xt-line bg-xt-paper text-xt-mute')}>{text}</button>)}
  </div>;
}

function DocumentInput({ label, note, file, onChange, selfie = false }: { label: string; note: string; file: File | null; onChange: (file: File | null) => void; selfie?: boolean }) {
  return (
    <label className="block rounded-[24px] border border-dashed border-xt-line bg-xt-paper p-5">
      <span className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-xt-sand text-xt-ink">{selfie ? <Camera className="h-5 w-5" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}</span>
        <span><span className="block text-base font-extrabold text-xt-ink">{label}</span><span className="mt-1 block text-sm text-xt-mute">{note}</span></span>
      </span>
      <input
        aria-label={label}
        type="file"
        accept={selfie ? 'image/jpeg,image/png,image/webp' : CHECK_IN_FILE_ACCEPT}
        {...(selfie ? { capture: 'user' as const } : {})}
        className="mt-4 min-h-[48px] w-full cursor-pointer rounded-xl text-base text-xt-ink file:mr-3 file:min-h-[48px] file:rounded-full file:border-0 file:bg-xt-ink file:px-4 file:font-bold file:text-xt-sand"
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.files?.[0] ?? null)}
      />
      {file && <span className="mt-2 flex items-center gap-2 break-all text-sm font-semibold text-xt-pine"><FileCheck2 className="h-4 w-4 shrink-0" aria-hidden />{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}
    </label>
  );
}

export default function SelfCheckIn({ initialPropertyId }: { initialPropertyId?: CheckInPropertyId }) {
  const [step, setStep] = useState(0);
  const [propertyId, setPropertyId] = useState<CheckInPropertyId>(initialPropertyId ?? 'XTSY-SHL-HOSTEL');
  const [isInternational, setIsInternational] = useState(false);
  const [bookingReference, setBookingReference] = useState('');
  const [guestName, setGuestName] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('10:00');
  const [formOpenedAt, setFormOpenedAt] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [referralSource, setReferralSource] = useState<(typeof REFERRAL_SOURCES)[number] | ''>('');
  const [mainDocMode, setMainDocMode] = useState<DocumentMode>('separate');
  const [guests, setGuests] = useState<{ name: string; docMode: DocumentMode }[]>([]);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [totalGuests, setTotalGuests] = useState(1);
  const [purpose, setPurpose] = useState<(typeof CHECK_IN_PURPOSES)[number]>('Leisure');
  const [roomTypeId, setRoomTypeId] = useState(roomPreferences(initialPropertyId ?? 'XTSY-SHL-HOSTEL')[0]?.id ?? '');
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const setFile = (key: string) => (file: File | null) => setFiles((f) => ({ ...f, [key]: file }));
  const [readPolicies, setReadPolicies] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [guestReceipt, setGuestReceipt] = useState<GuestReceipt | null>(null);
  const policyRef = useRef<HTMLDivElement>(null);
  const submit = useServerFn(submitCheckInFn);
  const getReceipt = useServerFn(getGuestCheckInFn);

  const property = CHECK_IN_PROPERTIES.find((p) => p.id === propertyId) ?? CHECK_IN_PROPERTIES[0];
  const rooms = useMemo(() => roomPreferences(propertyId), [propertyId]);
  const policies = useMemo(() => checkInPolicies(propertyId), [propertyId]);
  const documentLabel = isInternational ? 'Passport' : 'National ID';
  const slotLabel = (key: string) => {
    if (key === 'selfie') return 'Your selfie';
    if (key === 'visa') return 'Visa';
    if (key === 'front') return `${documentLabel} ${mainDocMode === 'single' ? '(one document)' : isInternational ? 'first page' : 'front'}`;
    if (key === 'back') return `${documentLabel} ${isInternational ? 'last page' : 'back'}`;
    const m = /^g(\d+)-(front|back|single)$/.exec(key);
    return m ? `Guest ${m[1]} ID ${m[2] === 'single' ? 'document' : m[2]}` : key;
  };

  const loadReceipt = async (value: Receipt) => {
    try {
      const result = await getReceipt({ data: value }) as GuestReceipt;
      setGuestReceipt(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open your private receipt.');
    }
  };

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`xtsy-self-check-in-receipt-${initialPropertyId ?? 'choose'}`);
      if (!saved) return;
      const value = JSON.parse(saved) as Receipt;
      if (!value.id || !value.accessToken) return;
      setReceipt(value);
      setStep(STEPS.length);
      void loadReceipt(value);
    } catch { /* a missing or unavailable session store does not block a new check-in */ }
    // Receipt restoration runs once per tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrival defaults to the moment this form was opened; the guest can still change it.
  useEffect(() => {
    const now = new Date();
    const open = arrivalFromOpen(now);
    setFormOpenedAt(now.toISOString());
    setCheckInDate(open.date);
    setCheckInTime(open.time);
    setCheckOutDate(arrivalFromOpen(new Date(now.getTime() + 86400_000)).date);
  }, []);

  useEffect(() => {
    const extra = Math.max(0, Math.min(59, Number(totalGuests) || 1) - 1);
    setGuests((g) => g.length === extra ? g : Array.from({ length: extra }, (_, i) => g[i] ?? { name: '', docMode: 'separate' as DocumentMode }));
  }, [totalGuests]);

  useEffect(() => {
    if (step !== 4) return;
    setReadPolicies(false);
    setPolicyAccepted(false);
    const el = policyRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setReadPolicies(true);
  }, [step, propertyId]);

  const chooseProperty = (id: CheckInPropertyId) => {
    setPropertyId(id);
    setRoomTypeId(roomPreferences(id)[0]?.id ?? '');
    setError('');
  };

  const detailsProblem = (): string | null => {
    if (guestName.trim().length < 2) return 'Enter the lead guest’s full name.';
    if (!checkInDate || !checkInTime) return 'Choose the check-in date and arrival time.';
    if (city.trim().length < 2 || state.trim().length < 2 || country.trim().length < 2) return 'Enter your city, state and country.';
    if ((phone.match(/\d/g)?.length ?? 0) < 10) return 'Enter a phone number with country code.';
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.';
    if (totalGuests < 1 || totalGuests > 60) return 'Total guests must be between 1 and 60.';
    const stay = checkOutProblem({ checkInDate, checkInTime, checkOutDate, checkOutTime });
    if (stay) return stay;
    if (emergencyName.trim().length < 2) return 'Enter an emergency contact name.';
    if ((emergencyPhone.match(/\d/g)?.length ?? 0) < 10) return 'Enter the emergency contact’s phone with country code.';
    if (!referralSource) return 'Tell us how you found XTSY.';
    return null;
  };

  const next = () => {
    setError('');
    if (step === 1) {
      const problem = detailsProblem();
      if (problem) return setError(problem);
    }
    if (step === 2) {
      const missingName = guests.findIndex((g) => g.name.trim().length < 2);
      if (missingName >= 0) return setError(`Enter the full name of guest ${missingName + 2}.`);
      let total = 0;
      for (const key of requiredDocumentKeys({ mainDocMode, isInternational, guests })) {
        const problem = clientFileProblem(files[key] ?? null, true, key === 'selfie');
        if (problem) return setError(`${slotLabel(key)}: ${problem}`);
        total += files[key]?.size ?? 0;
      }
      if (total > MAX_CHECK_IN_UPLOAD_BYTES) return setError('All documents together are too large. Please use smaller photos.');
    }
    if (step === 3 && !roomTypeId) return setError('Choose your preferred room, bed or tent.');
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const send = async () => {
    setError('');
    if (!readPolicies || !policyAccepted) return setError('Scroll through all policies, then accept them to finish.');
    setBusy(true);
    try {
      const details = validateCheckInDetails({
        propertyId, bookingReference, guestName, checkInDate, checkInTime, checkOutDate, checkOutTime,
        ...(formOpenedAt ? { formOpenedAt } : {}), emergencyName, emergencyPhone, referralSource, mainDocMode, guests, city, state, country, phone, email,
        totalGuests: Number(totalGuests), purpose, isInternational, roomTypeId, policyAccepted, policyVersion: CHECK_IN_POLICY_VERSION,
      });
      const body = new FormData();
      body.set('details', JSON.stringify(details));
      for (const key of requiredDocumentKeys({ mainDocMode, isInternational, guests })) { const f = files[key]; if (f) body.set(key, f); }
      const result = await submit({ data: body });
      setReceipt(result);
      setStep(STEPS.length);
      try { sessionStorage.setItem(`xtsy-self-check-in-receipt-${initialPropertyId ?? 'choose'}`, JSON.stringify(result)); } catch { /* private receipt remains visible */ }
      await loadReceipt(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete check-in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    try { sessionStorage.removeItem(`xtsy-self-check-in-receipt-${initialPropertyId ?? 'choose'}`); } catch { /* no-op */ }
    setReceipt(null); setGuestReceipt(null); setStep(0); setFiles({});
    setPolicyAccepted(false); setReadPolicies(false); setError('');
  };

  return (
    <main className="min-h-dvh bg-xt-paper text-xt-ink">
      <section className="bg-xt-ink px-4 py-10 text-xt-paper sm:px-8 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <p className="flex items-center gap-2 text-sm font-bold text-xt-sand"><ScanLine className="h-5 w-5" aria-hidden />XTSY contactless arrival</p>
          <h1 className="xt-display mt-4 text-5xl leading-none sm:text-7xl">Self check-in, at your pace.</h1>
          {initialPropertyId && <p className="mt-3 text-lg font-bold text-xt-paper">{property.name}</p>}
          <p className="mt-4 max-w-xl text-base leading-relaxed text-xt-fog">Share your arrival details and private documents before you reach the desk. Your room, bed or tent is allocated only after staff verification.</p>
          <div className="mt-5 flex items-center gap-2 text-sm text-xt-sand"><LockKeyhole className="h-4 w-4" aria-hidden />Private uploads · staff-verified arrival · no payment</div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        {step < STEPS.length && (
          <div className="mb-8" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
            <div className="flex items-center justify-between gap-4 text-sm font-bold text-xt-mute"><span>Step {step + 1} of {STEPS.length}</span><span>{STEPS[step]}</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-xt-sand"><div className="h-full rounded-full bg-xt-crimson transition-[width]" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
          </div>
        )}

        {step === 0 && <section className="space-y-6">
          <div><h2 className="xt-display text-4xl text-xt-ink">Where are you checking in?</h2><p className="mt-2 text-xt-mute">Choose the property on your confirmed booking.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CHECK_IN_PROPERTIES.filter((p) => !initialPropertyId || p.id === initialPropertyId).map((p) => <button key={p.id} type="button" onClick={() => chooseProperty(p.id)} aria-pressed={propertyId === p.id} className={cn('min-h-[112px] rounded-[24px] border-2 p-5 text-left', propertyId === p.id ? 'border-xt-ink bg-xt-sand' : 'border-xt-line bg-xt-paper')}>
              <span className="block text-lg font-extrabold text-xt-ink">{p.name}</span><span className="mt-2 block text-sm text-xt-mute">{p.location}</span>
            </button>)}
          </div>
          <fieldset className="rounded-[24px] bg-xt-cream p-5"><legend className="px-1 text-base font-extrabold text-xt-ink">Are you an international traveller?</legend><p className="mt-1 text-sm text-xt-mute">Select Yes if you are not an Indian citizen. Passport and visa documents will be required.</p><div className="mt-4 grid grid-cols-2 gap-3">
            {[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={isInternational === value} onClick={() => { setIsInternational(value); if (!value) setFiles((f) => ({ ...f, visa: null })); }} className={cn('min-h-[48px] rounded-full border-2 font-extrabold', isInternational === value ? 'border-xt-ink bg-xt-ink text-xt-sand' : 'border-xt-line bg-xt-paper text-xt-ink')}><Globe2 className="mr-2 inline h-4 w-4" aria-hidden />{value ? 'Yes' : 'No'}</button>)}
          </div></fieldset>
        </section>}

        {step === 1 && <section className="space-y-5">
          <div><h2 className="xt-display text-4xl text-xt-ink">Lead guest and arrival</h2><p className="mt-2 text-xt-mute">Use the same name shown on the identity document.</p></div>
          <Field label="Full name"><input className={field} autoComplete="name" value={guestName} onChange={(e) => setGuestName(e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Check-in date" hint="Filled in from when you opened this form. Tap to change."><input type="date" className={field} value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} /></Field><Field label="Check-in time" hint="Your arrival time. Tap to change."><input type="time" className={field} value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Check-out date"><input type="date" className={field} min={checkInDate || undefined} value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} /></Field><Field label="Check-out time"><input type="time" className={field} max={LATEST_CHECK_OUT} value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} /><span className="mt-1 block text-xs opacity-70">Latest 11:30 AM. Later than 10 AM may carry additional charges.</span></Field></div>
          <Field label="Booking reference (optional)" hint="For example XTSY-ABCDEF. Leave blank if the desk has not given you one."><input className={field} value={bookingReference} onChange={(e) => setBookingReference(e.target.value.toUpperCase())} /></Field>
          <div className="grid gap-4 sm:grid-cols-3"><Field label="City"><input className={field} autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} /></Field><Field label="State"><input className={field} autoComplete="address-level1" value={state} onChange={(e) => setState(e.target.value)} /></Field><Field label="Country"><input className={field} autoComplete="country-name" value={country} onChange={(e) => setCountry(e.target.value)} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Phone number"><input type="tel" inputMode="tel" className={field} autoComplete="tel" placeholder="With country code" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field><Field label="Email ID"><input type="email" inputMode="email" className={field} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Total number of guests"><input type="number" min={1} max={60} inputMode="numeric" className={field} value={totalGuests} onChange={(e) => setTotalGuests(Number(e.target.value))} /></Field><Field label="Purpose of travel"><select className={field} value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)}>{CHECK_IN_PURPOSES.map((p) => <option key={p}>{p}</option>)}</select></Field></div>
          <p className="text-sm text-xt-mute">You are the main guest. You will upload ID for each of the {totalGuests} guest{totalGuests === 1 ? '' : 's'} in the next step.</p>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Emergency contact name"><input className={field} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} /></Field><Field label="Emergency contact phone"><input type="tel" inputMode="tel" className={field} placeholder="With country code" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} /></Field></div>
          <Field label="How did you find XTSY?"><select className={field} value={referralSource} onChange={(e) => setReferralSource(e.target.value as typeof referralSource)}><option value="" disabled>Choose one</option>{REFERRAL_SOURCES.map((r) => <option key={r}>{r}</option>)}</select></Field>
        </section>}

        {step === 2 && <section className="space-y-5">
          <div><h2 className="xt-display text-4xl text-xt-ink">{isInternational ? 'Passport and visa' : 'National identity document'}</h2><p className="mt-2 text-xt-mute">Upload clear, uncropped JPG, PNG, WebP or PDF files. Maximum 8 MB each.</p></div>
          <div className="space-y-4 rounded-[28px] border border-xt-line bg-xt-cream/50 p-4 sm:p-5">
            <h3 className="text-lg font-extrabold text-xt-ink">Guest 1 · {guestName || 'Main guest'}</h3>
            <DocumentInput selfie label="Your selfie" note="Take a clear photo of your face with the front camera." file={files['selfie'] ?? null} onChange={setFile('selfie')} />
            <ModeToggle label="Main guest document format" value={mainDocMode} onChange={setMainDocMode} />
            {mainDocMode === 'single'
              ? <DocumentInput label={`${documentLabel} — one document`} note="Both sides or all pages in one file (a PDF works well)." file={files['front'] ?? null} onChange={setFile('front')} />
              : <>
                <DocumentInput label={`${documentLabel} — ${isInternational ? 'first page' : 'front'}`} note={isInternational ? 'The passport page with your photo and personal details.' : 'Front side of your government-issued national ID.'} file={files['front'] ?? null} onChange={setFile('front')} />
                <DocumentInput label={`${documentLabel} — ${isInternational ? 'last page' : 'back'}`} note={isInternational ? 'The final passport page with address or other printed details.' : 'Back side of the same national ID.'} file={files['back'] ?? null} onChange={setFile('back')} />
              </>}
            {isInternational && <DocumentInput label="Visa — one document" note="Upload your valid Indian visa or permitted entry document as one file." file={files['visa'] ?? null} onChange={setFile('visa')} />}
          </div>
          {guests.map((g, i) => { const n = i + 2; return <div key={n} className="space-y-4 rounded-[28px] border border-xt-line p-4 sm:p-5">
            <h3 className="text-lg font-extrabold text-xt-ink">Guest {n}</h3>
            <Field label={`Guest ${n} full name`}><input className={field} value={g.name} onChange={(e) => setGuests((all) => all.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></Field>
            <ModeToggle label={`Guest ${n} document format`} value={g.docMode} onChange={(m) => setGuests((all) => all.map((x, j) => j === i ? { ...x, docMode: m } : x))} />
            {g.docMode === 'single'
              ? <DocumentInput label={`Guest ${n} — ID, one document`} note="National ID or passport, all sides in one file." file={files[`g${n}-single`] ?? null} onChange={setFile(`g${n}-single`)} />
              : <>
                <DocumentInput label={`Guest ${n} — ID front`} note="Front side, or passport photo page." file={files[`g${n}-front`] ?? null} onChange={setFile(`g${n}-front`)} />
                <DocumentInput label={`Guest ${n} — ID back`} note="Back side, or passport last page." file={files[`g${n}-back`] ?? null} onChange={setFile(`g${n}-back`)} />
              </>}
          </div>; })}
          <p className="flex gap-2 rounded-2xl bg-xt-cream p-4 text-sm text-xt-mute"><LockKeyhole className="h-5 w-5 shrink-0 text-xt-ink" aria-hidden />Files are stored privately, never publicly listed. You and authorised staff can view or download them through private links.</p>
        </section>}

        {step === 3 && <section className="space-y-5">
          <div><h2 className="xt-display text-4xl text-xt-ink">What would you prefer?</h2><p className="mt-2 text-xt-mute">This records a preference only. Admin or the front desk allocates your actual room, bed or tent after checking your documents and booking.</p></div>
          <div className="grid gap-3">{rooms.map((room) => <button key={room.id} type="button" aria-pressed={roomTypeId === room.id} onClick={() => setRoomTypeId(room.id)} className={cn('min-h-[80px] rounded-[24px] border-2 p-5 text-left', roomTypeId === room.id ? 'border-xt-ink bg-xt-sand' : 'border-xt-line bg-xt-paper')}>
            <span className="block font-extrabold text-xt-ink">{room.name}</span><span className="mt-1 block text-sm text-xt-mute">{room.detail}</span>
          </button>)}</div>
        </section>}

        {step === 4 && <section className="space-y-5">
          <div><h2 className="xt-display text-4xl text-xt-ink">Read before you arrive</h2><p className="mt-2 text-xt-mute">Scroll through every section for {property.name}. The acceptance unlocks at the end.</p></div>
          <div ref={policyRef} tabIndex={0} onScroll={(e) => { const el = e.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 32) setReadPolicies(true); }} className="max-h-[440px] overflow-y-auto rounded-[24px] border border-xt-line bg-xt-paper p-5 outline-none focus:ring-2 focus:ring-xt-ink sm:p-7" aria-label="Property policies; scroll to the end">
            <div className="space-y-7">{policies.map((section, index) => <section key={section.title} className="border-b border-xt-line pb-6 last:border-0 last:pb-0"><h3 className="text-lg font-extrabold text-xt-ink">{index + 1}. {section.title}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-xt-mute">{section.lines.map((line) => <li key={line}>{line}</li>)}</ul></section>)}</div>
          </div>
          {!readPolicies && <p className="text-sm font-bold text-xt-crimson" role="status">Scroll to the bottom to continue.</p>}
          {readPolicies && <p className="flex items-center gap-2 text-sm font-bold text-xt-pine" role="status"><Check className="h-5 w-5" aria-hidden />You have reached the end.</p>}
          <label className="flex min-h-[64px] cursor-pointer items-start gap-3 rounded-2xl bg-xt-cream p-4 text-sm font-semibold text-xt-ink"><input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0" checked={policyAccepted} disabled={!readPolicies} onChange={(e) => setPolicyAccepted(e.target.checked)} /><span>I have read and accept the property policies, privacy consent and the clearly stated cancellation/no-refund policy.</span></label>
        </section>}

        {step === STEPS.length && <section className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-xt-pine text-xt-paper"><Check className="h-8 w-8" aria-hidden /></div>
          <div><h2 className="xt-display text-5xl text-xt-ink">Check-in details received.</h2><p className="mx-auto mt-3 max-w-xl text-xt-mute">Thank you{guestReceipt ? `, ${guestReceipt.checkIn.guestName}` : ''}. The front desk will verify your documents and allocate your room, bed or tent. This is not a room allocation or payment confirmation.</p></div>
          {receipt && <div className="rounded-[24px] bg-xt-cream p-5 text-left"><p className="font-extrabold text-xt-ink">Your private document receipt</p><p className="mt-1 text-sm text-xt-mute">These links expire after five minutes for privacy. Reload this page in the same tab to request fresh links.</p>{!guestReceipt && <p className="mt-4 text-sm font-bold text-xt-ink" role="status">Preparing private links…</p>}<div className="mt-4 space-y-3">
            {(guestReceipt?.checkIn.documentList ?? []).map(({ key: kind, label }) => guestReceipt?.documents[kind] && <div key={kind} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-xt-paper p-3"><span className="flex items-center gap-2 font-bold text-xt-ink"><FileText className="h-5 w-5" aria-hidden />{label}</span><span className="flex gap-2"><a className="inline-flex min-h-[48px] items-center rounded-full border border-xt-line px-4 text-sm font-bold text-xt-ink" href={guestReceipt.documents[kind]?.viewUrl} target="_blank" rel="noopener noreferrer">View</a><a className="inline-flex min-h-[48px] items-center gap-1 rounded-full bg-xt-ink px-4 text-sm font-bold text-xt-sand" href={guestReceipt.documents[kind]?.downloadUrl}><Download className="h-4 w-4" aria-hidden />Download</a></span></div>)}
          </div></div>}
          {error && <p role="alert" className="rounded-2xl bg-xt-blush p-4 text-left text-sm text-xt-crimson-dark">{error}</p>}
          <button type="button" onClick={reset} className={cn(button, 'border border-xt-line bg-xt-paper text-xt-ink')}><UserRound className="h-5 w-5" aria-hidden />Start another check-in</button>
        </section>}

        {step < STEPS.length && <>
          {error && <p role="alert" className="mt-5 rounded-2xl bg-xt-blush p-4 text-sm font-semibold text-xt-crimson-dark">{error}</p>}
          <div className="mt-8 flex items-center justify-between gap-3">
            <button type="button" disabled={step === 0 || busy} onClick={() => { setError(''); setStep((s) => Math.max(0, s - 1)); }} className={cn(button, 'border border-xt-line bg-xt-paper text-xt-ink')}><ArrowLeft className="h-5 w-5" aria-hidden />Back</button>
            {step < 4 ? <button type="button" onClick={next} className={cn(button, 'bg-xt-ink text-xt-sand')}>Next<ArrowRight className="h-5 w-5" aria-hidden /></button>
              : <button type="button" disabled={busy || !readPolicies || !policyAccepted} onClick={() => void send()} className={cn(button, 'bg-xt-crimson text-xt-paper')}>{busy ? 'Uploading securely…' : 'Complete self check-in'}<Check className="h-5 w-5" aria-hidden /></button>}
          </div>
          {step === 4 && <p className="mt-3 text-right text-xs text-xt-mute"><Wifi className="mr-1 inline h-4 w-4" aria-hidden />No payment is taken in this form.</p>}
        </>}
      </div>
    </main>
  );
}
