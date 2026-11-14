import { createFileRoute } from "@tanstack/react-router";
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import MeghalayaFestivals from "@/pages/v2/MeghalayaFestivalsV2";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/meghalaya-festivals")({
  head: () =>
    buildRouteHead({
      path: "/meghalaya-festivals",
      jsonLd: [articleSchema({ path: "/meghalaya-festivals", headline: "Meghalaya Festivals: When and Where to See Them | XTSY", description: "Shad Suk Mynsiem, Behdienkhlam, Nongkrem, Wangala and the Shillong Cherry Blossom Festival: when they happen, where, and how to plan a trip around them." })],
      title: "Meghalaya Festivals: When and Where to See Them | XTSY",
      description:
        "Shad Suk Mynsiem, Behdienkhlam, Nongkrem, Wangala and the Shillong Cherry Blossom Festival: when they happen, where, and how to plan a trip around them.",
      ogType: "article",
    }),
  component: MeghalayaFestivals,
});
