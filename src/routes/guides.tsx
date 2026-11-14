import { createFileRoute } from "@tanstack/react-router";
import GuidesDirectoryV2 from "@/pages/v2/GuidesDirectoryV2";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/guides")({
  // The directory data is imported on demand (server-side on first load), out of the main bundle.
  loader: async () => (await import("@/lib/seo/guidePageData")).guidesPayload(),
  head: ({ loaderData }) => {
    const items = loaderData?.groups.flatMap((g) => g.pages) ?? [];
    return buildRouteHead({
      path: "/guides",
      title: "Shillong & Meghalaya Guides, Adventure Routes | XTSY",
      description: "Browse Shillong and Meghalaya guides, Northeast itineraries and road or bike routes. Find destinations, stays, dining and transport guides grouped by topic.",
      keywords: "Shillong travel guides, Meghalaya guides, Northeast India travel guide, XTSY guides",
      jsonLd: [{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "XTSY page directory",
        url: "https://xtsy.one/guides",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: items.length,
          itemListElement: items.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.label, url: `https://xtsy.one/${p.slug}` })),
        },
      }],
    });
  },
  component: GuidesDirectoryV2,
});
