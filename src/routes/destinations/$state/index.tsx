import { createFileRoute } from "@tanstack/react-router";
import StateHub from "@/pages/destinations/StateHub";
import { fitTitle } from "@/lib/seo/fitTitle";
import { buildRouteHead } from "@/lib/seo-head";
import { getStateBySlug } from "@/data/neTaxonomy";
import { describePage } from "@/lib/seo/metadataText";

export const Route = createFileRoute("/destinations/$state/")({
  head: ({ params }) => {
    const state = getStateBySlug(params.state);
    const name = state?.name ?? "Northeast India";
    return buildRouteHead({
      path: `/destinations/${params.state}`,
      title: fitTitle([`${name} Travel Guide — Places, Routes & Stays`, `${name} Travel Guide — Places & Routes`, `${name} Travel Guide | XTSY`]),
      description: describePage(state?.blurb ?? "Travel guide to Northeast India: attractions, base towns, how to reach and where to stay.",
        `Plan a ${name} journey with routes, seasonal advice, access information and onward travel from Shillong.`),
      noIndex: !state,
    });
  },
  component: StateHub,
});
