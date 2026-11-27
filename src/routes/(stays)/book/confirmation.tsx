import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { buildRouteHead } from "@/lib/seo-head";
import { getPublicBookingFn } from "@/booking/publicEngine.functions";
import type { PublicBooking } from "@/booking/publicEngine.core";
import { formatInr } from "@/booking/money";
import { BOOKING_POLICY_TEXT, HOSTEL_POLICIES } from "@/data/hostelPolicies";

export const Route = createFileRoute("/(stays)/book/confirmation")({
  validateSearch: z.object({ ref: z.string().max(20).optional(), failed: z.string().optional() }),
  head: () =>
    buildRouteHead({
      path: "/book/confirmation",
      noIndex: true,
      title: "Booking status | XTSY",
      description: "Your XTSY booking status.",
    }),
  component: Confirmation,
});

const dateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`));

function Confirmation() {
  const { ref } = Route.useSearch();
  const [b, setB] = useState<PublicBooking | null | undefined>(undefined);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!ref) return setB(null);
    let stale = false;
    getPublicBookingFn({ data: { ref } }).then((r) => !stale && setB(r)).catch(() => !stale && setB(null));
    return () => { stale = true; };
  }, [ref, tries]);

  // Payment confirmations can take a few seconds to arrive; check again a few times.
  useEffect(() => {
    if (b?.status !== "pending" || tries >= 6) return;
    const t = setTimeout(() => setTries((n) => n + 1), 5000);
    return () => clearTimeout(t);
  }, [b, tries]);

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      {b === undefined && <p className="text-muted-foreground">Checking your booking…</p>}
      {b === null && (
        <section className="space-y-3">
          <h1 className="text-2xl font-semibold">We couldn’t find that booking</h1>
          <p className="text-muted-foreground">Check the link from your payment confirmation, or WhatsApp the desk on +91 88373 17070 with your reference.</p>
        </section>
      )}
      {b && (
        <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            {b.status === "confirmed" ? <CheckCircle2 className="h-7 w-7 text-emerald-400" aria-hidden /> : b.status === "pending" ? <Clock className="h-7 w-7 text-amber-400" aria-hidden /> : <XCircle className="h-7 w-7 text-red-400" aria-hidden />}
            <div>
              <h1 className="text-2xl font-semibold">
                {b.status === "confirmed" ? "Booking confirmed" : b.status === "pending" ? "Waiting for payment confirmation" : b.status === "cancelled" ? "Booking cancelled" : "Payment not completed"}
              </h1>
              <p className="text-sm text-muted-foreground">Reference <span className="font-mono text-foreground">{b.reference}</span></p>
            </div>
          </div>
          {b.status === "failed" && <p className="text-sm">No booking was made and the rooms were released. You can <Link to="/book" className="underline">try again</Link>.</p>}
          {b.status === "pending" && <p className="text-sm text-muted-foreground">This usually takes a few seconds. This page checks again on its own.</p>}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Check-in</dt><dd>{fmt(b.checkIn)}, from {HOSTEL_POLICIES.checkIn}</dd></div>
            <div><dt className="text-muted-foreground">Check-out</dt><dd>{fmt(b.checkOut)}, by {HOSTEL_POLICIES.checkOut}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Rooms</dt><dd>{b.rooms.map((r) => `${r.units} × ${r.name}`).join(", ")} · {b.nights} night(s)</dd></div>
            <div><dt className="text-muted-foreground">Booking total</dt><dd>{formatInr(b.total)}</dd></div>
            <div><dt className="text-muted-foreground">Advance</dt><dd>{formatInr(b.advance)}{b.status === "confirmed" ? " paid" : ""}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Due at check-in</dt><dd className="font-medium">{formatInr(b.balance)}</dd></div>
          </dl>
          {b.status === "confirmed" && (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>{BOOKING_POLICY_TEXT.cancellation}</p>
              <p>Date change: one, requested by {fmt(b.lastChangeDate)} (at least {HOSTEL_POLICIES.modificationCutoffDays} days before check-in), subject to availability.</p>
              <p>XTSY Travellers Hostel, Mawdiangdiang Road, New Shillong Township. Questions: WhatsApp +91 88373 17070 with your reference.</p>
              <p><Link to="/book/manage" search={{ ref: b.reference }} className="font-medium text-foreground underline">Manage your booking</Link>: pay the balance or ask for your date change. Keep your reference; you’ll need it with your phone number.</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
