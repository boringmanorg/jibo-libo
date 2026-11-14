import { createFileRoute } from "@tanstack/react-router";
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import BlogBestTimeToVisit from "@/pages/destinations/BlogBestTimeToVisit";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/best-time-to-visit-meghalaya")({
  head: () =>
    buildRouteHead({
      path: "/best-time-to-visit-meghalaya",
      jsonLd: [articleSchema({ path: "/best-time-to-visit-meghalaya", headline: "Best Time to Visit Meghalaya (Month by Month) | XTSY", description: "Month-by-month weather, rainfall and crowd guide for Meghalaya, with the best windows for waterfalls, root bridges, Dawki boating and hostel rates." })],
      title: "Best Time to Visit Meghalaya (Month by Month) | XTSY",
      description:
        "Month-by-month weather, rainfall and crowd guide for Meghalaya, with the best windows for waterfalls, root bridges, Dawki boating and hostel rates.",
    }),
  component: BlogBestTimeToVisit,
});
