import { createFileRoute } from "@tanstack/react-router";
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import BlogHiddenPlaces from "@/pages/destinations/BlogHiddenPlaces";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/(guides)/guides/hidden-places-in-meghalaya")({
  head: () =>
    buildRouteHead({
      path: "/guides/hidden-places-in-meghalaya",
      jsonLd: [articleSchema({ path: "/guides/hidden-places-in-meghalaya", headline: "Hidden Places in Meghalaya Tourists Miss | XTSY", description: "Lesser-known Meghalaya spots beyond Cherrapunji and Dawki: quiet waterfalls, canyons, village trails and viewpoints, with how to reach each from Shillong." })],
      title: "Hidden Places in Meghalaya Tourists Miss | XTSY",
      description:
        "Lesser-known Meghalaya spots beyond Cherrapunji and Dawki: quiet waterfalls, canyons, village trails and viewpoints, with how to reach each from Shillong.",
    }),
  component: BlogHiddenPlaces,
});
