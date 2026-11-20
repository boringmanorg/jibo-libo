import { createFileRoute } from "@tanstack/react-router";
import SimplifiedBookingFlow from "@/pages/SimplifiedBookingFlow";
import StayEngine from "@/components/booking/engine/StayEngine";
import { getEngineStatus } from "@/booking/publicEngine.functions";
import { buildRouteHead } from "@/lib/seo-head";
import { inr, roomPrice } from "@/components/v2/pricing";
import { PANORAMA_STAY_ONLY } from "@/data/panoramaPricing";

export const Route = createFileRoute("/(stays)/book/")({
  head: () =>
    buildRouteHead({
      path: "/book",
      noIndex: true,
      noIndexFollow: true,
      title: "Hostel Booking Shillong — Book Dorms & Rooms Online | XTSY",
      description:
        `Book XTSY in New Shillong Township: dorms from ${inr(roomPrice("8-bed-mixed-dorm").now)}, King Double ${inr(roomPrice("king-double-room").now)}, Experience by XTSY ${inr(PANORAMA_STAY_ONLY)}. Check-in 11 AM, check-out 10 AM.`,
      keywords:
        "hostel booking, online hostel booking, book hostel shillong, dorm booking shillong, hostel booking meghalaya",
    }),
  // The live engine appears only when the console's launch gate allows it (STAAH connected,
  // rooms mapped, payment keys saved, switch on). Until then, and on any error, guests keep
  // the WhatsApp enquiry flow.
  loader: async () => {
    try {
      return await getEngineStatus();
    } catch {
      return { live: false };
    }
  },
  component: BookPage,
});

function BookPage() {
  const { live } = Route.useLoaderData();
  return live ? <StayEngine mode="live" /> : <SimplifiedBookingFlow />;
}
