import { createFileRoute } from "@tanstack/react-router";
import CampsiteBookingFlow from "@/pages/CampsiteBookingFlow";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/(stays)/book/campsite")({
  head: () =>
    buildRouteHead({
      path: "/book/campsite",
      noIndex: true,
      noIndexFollow: true,
      title: "Book Shnonpedeng Riverside Camping | XTSY",
      description:
        "Book riverside tents at Shnonpedeng on the Umngot, an XTSY franchise partner camp: full tent for two ₹1,400 a night, bed space ₹750, breakfast and dinner on request.",
    }),
  component: CampsiteBookingFlow,
});
