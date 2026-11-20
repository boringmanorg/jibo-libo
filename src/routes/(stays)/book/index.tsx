import { createFileRoute } from "@tanstack/react-router";
import StayEngine from "@/components/booking/engine/StayEngine";
import { getBookPageDataFn } from "@/booking/publicEngine.functions";
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
  // Online payment appears only when the console's launch gate allows it (STAAH connected,
  // rooms mapped, payment and bot-check keys saved, switch on). Until then, and on any error,
  // the same page runs from the static catalogue and ends in a WhatsApp enquiry.
  // A paused Cloud database must not hold the page: after 1.5 s guests get the enquiry page with
  // the built-in photos.
  loader: async () => {
    const fallback = { live: false, photos: {} as Record<string, { src: string; alt: string }[]> };
    try {
      return await Promise.race([
        getBookPageDataFn(),
        new Promise<typeof fallback>((resolve) => setTimeout(() => resolve(fallback), 1500)),
      ]);
    } catch {
      return fallback;
    }
  },
  component: BookPage,
});

function BookPage() {
  const { live, photos } = Route.useLoaderData();
  return <StayEngine mode={live ? "live" : "enquiry"} photos={photos} />;
}
