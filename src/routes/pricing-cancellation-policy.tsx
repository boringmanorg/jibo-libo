import { createFileRoute } from "@tanstack/react-router";
import { infoPageSchema } from "@/lib/seo/pageEntitySchema";
import PricingCancellationPolicy from "@/pages/PricingCancellationPolicy";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/pricing-cancellation-policy")({
  head: () =>
    buildRouteHead({
      path: "/pricing-cancellation-policy",
      jsonLd: [infoPageSchema({ path: "/pricing-cancellation-policy", name: "Pricing & Cancellation Policy | XTSY Shillong", description: "XTSY room rates, taxes, deposits and the full cancellation and no-show policy for hostel bookings, tour packages and group reservations." })],
      title: "Pricing & Cancellation Policy | XTSY Shillong",
      description:
        "XTSY room rates, taxes, deposits and the full cancellation and no-show policy for hostel bookings, tour packages and group reservations.",
    }),
  component: PricingCancellationPolicy,
});
