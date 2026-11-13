import { createFileRoute } from "@tanstack/react-router";
import Unsubscribe from "@/pages/Unsubscribe";
import { buildRouteHead } from "@/lib/seo-head";

/**
 * The page component existed but had no route, so /unsubscribe answered 404.
 * Any unsubscribe link already sent out pointed at a dead URL — the one link
 * that must never break, even though XTSY keeps no mailing list today.
 * noIndex: a utility page with nothing to rank.
 */
export const Route = createFileRoute("/unsubscribe")({
  head: () =>
    buildRouteHead({
      path: "/unsubscribe",
      title: "Unsubscribe | XTSY",
      description:
        "XTSY does not send marketing email or keep a subscriber list. Booking conversations happen on WhatsApp.",
      noIndex: true,
    }),
  component: Unsubscribe,
});
