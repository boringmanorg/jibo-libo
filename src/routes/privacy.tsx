import { createFileRoute } from "@tanstack/react-router";
import NotFound from "@/pages/NotFound";
import { buildRouteHead } from "@/lib/seo-head";

/**
 * Permanently removed URL (listed in GONE_SLUGS).
 *
 * This route exists so the URL gets a real "gone" page and a noindex head
 * instead of the generic 404. The 410 status itself is applied in
 * src/server.ts (withGoneStatus) — the router forces 200 on any matched
 * route, so it cannot be set from here.
 */
export const Route = createFileRoute("/privacy")({
  head: () =>
    buildRouteHead({
      path: "/privacy",
      title: "Page removed | XTSY",
      description:
        "This page has been permanently removed. Explore XTSY Travellers Hostel stays in New Shillong, Meghalaya tours by XTSY Voyage, and TAB Bistro dining.",
      noIndex: true,
    }),
  component: GonePage,
});

function GonePage() {
  return <NotFound statusCode={410} />;
}
