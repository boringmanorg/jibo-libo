import { createFileRoute } from "@tanstack/react-router";
import { collectionSchema } from "@/lib/seo/pageEntitySchema";
import DestinationsIndex from "@/pages/destinations/DestinationsIndex";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/destinations/")({
  head: () =>
    buildRouteHead({
      path: "/destinations",
      jsonLd: [collectionSchema({ path: "/destinations", name: "Northeast India Destinations — State & City Guides | XTSY", description: "Browse Northeast India by state and base town: Meghalaya, Assam, Arunachal, Nagaland, Manipur, Mizoram and Tripura — attractions, routes and where to stay." })],
      title: "Northeast India Destinations — State & City Guides | XTSY",
      description:
        "Browse Northeast India by state and base town: Meghalaya, Assam, Arunachal, Nagaland, Manipur, Mizoram and Tripura — attractions, routes and where to stay.",
    }),
  component: DestinationsIndex,
});
