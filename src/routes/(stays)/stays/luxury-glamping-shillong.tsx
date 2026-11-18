import { createFileRoute } from "@tanstack/react-router";
import LuxuryGlampingShillong from "@/pages/LuxuryGlampingShillong";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/(stays)/stays/luxury-glamping-shillong")({
  head: () =>
    buildRouteHead({
      path: "/stays/luxury-glamping-shillong",
      title: "Luxury Glamping in Shillong & Meghalaya | XTSY",
      description:
        "Glamping near Shillong with proper beds, private washrooms and mountain views, including Experience by XTSY, India's Most Romantic Couple En-suite, for couples.",
    }),
  component: LuxuryGlampingShillong,
});
