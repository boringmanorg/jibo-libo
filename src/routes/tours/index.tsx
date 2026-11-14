import { createFileRoute } from "@tanstack/react-router";
import Tours from "@/pages/v2/ToursV2";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/tours/")({
  head: () =>
    buildRouteHead({
      path: "/tours",
      title: "Meghalaya, Northeast India & Beyond Tour Packages | XTSY",
      description:
        "Explore Meghalaya, Northeast India and beyond with XTSY Voyage. Compare itineraries, browse signature packages and enquire about your dates and group size.",
      keywords:
        "Northeast India tours, Meghalaya tour packages, Nagaland tours, Assam safari, Arunachal Pradesh trips, Sikkim tours",
    }),
  component: Tours,
});
