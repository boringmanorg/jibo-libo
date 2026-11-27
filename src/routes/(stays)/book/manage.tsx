import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useState, type FormEvent } from "react";
import { buildRouteHead } from "@/lib/seo-head";
import { manageLookupFn, payBalanceFn, requestDateChangeFn } from "@/booking/publicEngine.functions";
import type { ManagedBooking } from "@/booking/manageBooking.server";
import { formatInr } from "@/booking/money";
import { addDays, todayInIndia, type IsoDate } from "@/booking/dates";
import { BOOKING_POLICY_TEXT, HOSTEL_POLICIES } from "@/data/hostelPolicies";

/**
 * Manage my booking: reference + the phone number booked with. Pay what is due, or ask for the one
 * date change (at least 14 days before check-in). Private page: never indexed.
 */
export const Route = createFileRoute("/(stays)/book/manage")({
  validateSearch: z.object({ ref: z.string().max(20).optional() }),
  head: () =>
    buildRouteHead({
      path: "/book/manage",
      noIndex: true,
      title: "Manage your booking | XTSY",
      description: "See your XTSY booking, pay the balance and ask for a date change.",
    }),
  component: ManageBooking,
});

const dateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`));
const STATUS: Record<ManagedBooking["status"], string> = {
  confirmed: "Confirmed", checked_in: "Checked in", completed: "Stay completed", cancelled: "Cancelled", awaiting_payment: "Waiting for the advance",
};
const input = "mt-1 block min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base";

function ManageBooking() {
  const { ref } = Route.useSearch();
  const [reference, setReference] = useState(ref ?? "");
  const [phone, setPhone] = useState("");
  const [b, setB] = useState<ManagedBooking | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "find" | "pay" | "change">("");

  const find = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("find"); setError("");
    const r = await manageLookupFn({ data: { reference, phone } }).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }));
    setBusy("");
    if (r.ok) setB(r.data); else { setB(null); setError(r.error); }
  };

  const pay = async () => {
    setBusy("pay"); setError("");
    const r = await payBalanceFn({ data: { reference, phone } }).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }));
    if (r.ok) { window.location.assign(r.data.url); return; }
    setBusy(""); setError(r.error);
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Manage your booking</h1>
      <p className="mt-2 text-muted-foreground">Enter your booking reference and the phone number you booked with.</p>

      {!b && (
        <form onSubmit={find} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
          <label className="block text-sm font-medium">Booking reference
            <input className={`${input} font-mono uppercase`} value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} placeholder="XTSY-7KQ2MA" autoComplete="off" required maxLength={20} />
          </label>
          <label className="block text-sm font-medium">Phone number
            <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" required maxLength={20} />
          </label>
          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
          <button type="submit" disabled={busy !== ""} className="min-h-12 w-full rounded-full bg-foreground px-6 font-semibold text-background disabled:opacity-50">
            {busy === "find" ? "Finding your booking…" : "Find my booking"}
          </button>
        </form>
      )}

      {b && (
        <section className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-6">
          <div>
            <p className="text-sm text-muted-foreground">Hello {b.firstName}. Reference <span className="font-mono text-foreground">{b.reference}</span></p>
            <p className="mt-1 text-xl font-semibold">{STATUS[b.status]}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Check-in</dt><dd>{fmt(b.checkIn)}, from {HOSTEL_POLICIES.checkIn}</dd></div>
            <div><dt className="text-muted-foreground">Check-out</dt><dd>{fmt(b.checkOut)}, by {HOSTEL_POLICIES.checkOut}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Rooms</dt><dd>{b.rooms.map((r) => `${r.units} × ${r.name}`).join(", ")} · {b.nights} night{b.nights === 1 ? "" : "s"}</dd></div>
            <div><dt className="text-muted-foreground">Booking total</dt><dd>{formatInr(b.total)}</dd></div>
            <div><dt className="text-muted-foreground">Paid</dt><dd>{formatInr(b.paid)}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Still to pay</dt><dd className="text-lg font-semibold">{formatInr(b.due)}</dd></div>
          </dl>

          {b.due > 0 && (b.status === "confirmed" || b.status === "checked_in") && (
            <div className="space-y-2 border-t border-border pt-5">
              <h2 className="font-semibold">Pay the balance</h2>
              {b.canPay ? (
                <>
                  <p className="text-sm text-muted-foreground">Pay now by UPI or card, or at the desk when you arrive.</p>
                  <button type="button" onClick={pay} disabled={busy !== ""} className="min-h-12 rounded-full bg-foreground px-6 font-semibold text-background disabled:opacity-50">
                    {busy === "pay" ? "Opening payment…" : `Pay ${formatInr(b.due)}`}
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Pay at the desk when you arrive, by UPI, card or cash.</p>
              )}
            </div>
          )}

          <DateChange b={b} reference={reference} phone={phone} onDone={setB} busy={busy} setBusy={setBusy} />

          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
          <p className="border-t border-border pt-5 text-sm text-muted-foreground">{BOOKING_POLICY_TEXT.cancellation} Questions: WhatsApp +91 88373 17070 with your reference.</p>
          <button type="button" onClick={() => { setB(null); setPhone(""); setError(""); }} className="text-sm underline">Look up another booking</button>
        </section>
      )}

      <p className="mt-8 text-sm text-muted-foreground"><Link to="/book" className="underline">Book another stay</Link></p>
    </main>
  );
}

function DateChange({ b, reference, phone, onDone, busy, setBusy }: {
  b: ManagedBooking; reference: string; phone: string; onDone: (b: ManagedBooking) => void;
  busy: string; setBusy: (v: "" | "find" | "pay" | "change") => void;
}) {
  const earliest = addDays(todayInIndia(new Date()), HOSTEL_POLICIES.modificationCutoffDays);
  const [checkIn, setCheckIn] = useState<IsoDate>(earliest > b.checkIn ? earliest : b.checkIn);
  const [checkOut, setCheckOut] = useState<IsoDate>(addDays(earliest > b.checkIn ? earliest : b.checkIn, b.nights));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const req = b.request;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("change"); setError("");
    const r = await requestDateChangeFn({ data: { reference, phone, checkIn, checkOut, note: note || undefined } }).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }));
    setBusy("");
    if (r.ok) onDone(r.data); else setError(r.error);
  };

  return (
    <div className="space-y-3 border-t border-border pt-5">
      <h2 className="font-semibold">Change your dates</h2>
      {req?.status === "pending" && <p className="text-sm">Your request for <strong>{fmt(req.checkIn)} → {fmt(req.checkOut)}</strong> is with the desk. They’ll confirm on WhatsApp, and any higher price is added to what’s still to pay.</p>}
      {req?.status === "declined" && <p className="text-sm">The desk couldn’t move your stay to {fmt(req.checkIn)} → {fmt(req.checkOut)}{req.reason ? `: ${req.reason}` : "."}</p>}
      {req?.status === "applied" && <p className="text-sm">Your dates were changed. That was your one date change.</p>}
      {b.dateChange.allowed ? (
        <form onSubmit={send} className="space-y-3">
          <p className="text-sm text-muted-foreground">One change per booking, at least {HOSTEL_POLICIES.modificationCutoffDays} days before check-in{b.dateChange.lastDate ? ` (ask by ${fmt(b.dateChange.lastDate)})` : ""}, subject to availability. A higher price for the new dates is added to the balance; a lower one is not refunded.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">New check-in
              <input type="date" className={input} min={earliest} value={checkIn} onChange={(e) => { const v = e.target.value as IsoDate; setCheckIn(v); if (checkOut <= v) setCheckOut(addDays(v, b.nights)); }} required />
            </label>
            <label className="block text-sm font-medium">New check-out
              <input type="date" className={input} min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value as IsoDate)} required />
            </label>
          </div>
          <label className="block text-sm font-medium">Note for the desk (optional)
            <input className={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </label>
          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
          <button type="submit" disabled={busy !== ""} className="min-h-12 rounded-full border border-foreground px-6 font-semibold disabled:opacity-50">
            {busy === "change" ? "Sending…" : "Ask for these dates"}
          </button>
        </form>
      ) : (
        req?.status !== "pending" && <p className="text-sm text-muted-foreground">{b.dateChange.reason ?? "This booking can’t change dates online."}</p>
      )}
    </div>
  );
}
